import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { DeviceToken } from './entities/device-token.entity';

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Sends push notifications to staff phones through Firebase Cloud Messaging.
 *
 * Credentials (never committed): set ONE of
 *   FIREBASE_SERVICE_ACCOUNT_PATH   path to the service-account .json file
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 the same file, base64-encoded
 * Without either, push is simply disabled and the rest of the API works.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private app: admin.app.App | null = null;
  private initTried = false;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly tokens: Repository<DeviceToken>,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------- tokens

  /** Saves the token for this user. A token that was on another user moves here. */
  async register(userId: string, token: string, platform = 'android') {
    const existing = await this.tokens.findOne({ where: { token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      await this.tokens.save(existing);
    } else {
      await this.tokens.save(this.tokens.create({ userId, token, platform }));
    }
    return { registered: true };
  }

  async unregister(userId: string, token: string) {
    await this.tokens.delete({ userId, token });
    return { unregistered: true };
  }

  // ------------------------------------------------------------------ push

  /**
   * Sends a test push to the CALLER's own phones and says what happened, so a
   * missing push can be traced: Firebase not configured, no phone registered,
   * or Firebase refusing the send.
   */
  async sendTest(userId: string) {
    const app = this.getApp();
    const rows = await this.tokens.find({ where: { userId } });
    if (!app) {
      return { firebaseEnabled: false, devices: rows.length, sent: 0, failed: 0, hint: 'Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_BASE64 on the server and restart it.' };
    }
    if (rows.length === 0) {
      return { firebaseEnabled: true, devices: 0, sent: 0, failed: 0, hint: 'No phone is registered for this account. Sign in on the phone against this same server.' };
    }
    try {
      const res = await app.messaging().sendEachForMulticast({
        tokens: rows.map((r) => r.token),
        notification: { title: 'StockFlow test', body: 'Push notifications are working.' },
        android: { priority: 'high', notification: { sound: 'default' } },
      });
      return {
        firebaseEnabled: true,
        devices: rows.length,
        sent: res.successCount,
        failed: res.failureCount,
        errors: res.responses.filter((r) => !r.success).map((r) => r.error?.code),
      };
    } catch (err: any) {
      return { firebaseEnabled: true, devices: rows.length, sent: 0, failed: rows.length, errors: [err?.message] };
    }
  }

  private getApp(): admin.app.App | null {
    if (this.app || this.initTried) return this.app;
    this.initTried = true;
    try {
      const path = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
      const b64 = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64');
      let json: string | null = null;
      if (path && existsSync(path)) json = readFileSync(path, 'utf8');
      else if (b64) json = Buffer.from(b64, 'base64').toString('utf8');
      if (!json) {
        this.logger.warn(
          'Push disabled: set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_BASE64.',
        );
        return null;
      }
      this.app = admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(json)),
      });
      this.logger.log('Firebase push enabled.');
    } catch (err: any) {
      this.logger.error(`Firebase init failed: ${err?.message}`);
      this.app = null;
    }
    return this.app;
  }

  /** Push to every registered staff phone. Never throws. */
  async notifyAllStaff(payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    try {
      const app = this.getApp();
      if (!app) return;
      const rows = await this.tokens.find();
      if (rows.length === 0) return;

      // sendEachForMulticast accepts at most 500 tokens per call.
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const res = await app.messaging().sendEachForMulticast({
          tokens: chunk.map((r) => r.token),
          notification: { title: payload.title, body: payload.body },
          data: payload.data ?? {},
          android: {
            priority: 'high',
            notification: { sound: 'default' },
          },
        });

        const dead: string[] = [];
        res.responses.forEach((r, idx) => {
          if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
            dead.push(chunk[idx].token);
          }
        });
        if (dead.length) await this.tokens.delete({ token: In(dead) });
        this.logger.log(
          `Push sent: ${res.successCount} ok, ${res.failureCount} failed.`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Push failed: ${err?.message}`);
    }
  }

  notifyNewCustomerOrder(orderId: string, orderNo: string, customerName: string, total: number) {
    return this.notifyAllStaff({
      title: 'New customer order',
      body: `${customerName} placed order #${orderNo} ($${Number(total).toFixed(2)})`,
      data: { type: 'CUSTOMER_ORDER', orderId },
    });
  }
}
