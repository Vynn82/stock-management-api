import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Customer } from '../entities/customer.entity';
import { CustomerTelegramAccount } from '../entities/customer-telegram-account.entity';
import { CustomerStatus } from '../enums/customer-status.enum';
import {
  CustomerQueryDto,
  CustomerRegisterDto,
} from '../dto/customer-registration.dto';
import { TelegramBotService } from './telegram-bot.service';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+8550')) {
    return '0' + cleaned.slice(5);
  }
  if (cleaned.startsWith('+855')) {
    return '0' + cleaned.slice(4);
  }
  return cleaned;
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\b(co|ltd|company|limited|corp|corporation|inc)\b/g, '')
    .replace(/\s+/g, '')
    .trim();
}

@Injectable()
export class TelegramAuthService {
  private readonly logger = new Logger(TelegramAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerTelegramAccount)
    private readonly accountRepo: Repository<CustomerTelegramAccount>,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  private getBotToken(): string {
    const rawToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    return rawToken.replace(/^["']|["']$/g, '').trim();
  }

  /**
   * Validates Telegram WebApp initData string using HMAC-SHA-256.
   * Specification: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   */
  public validateTelegramInitData(
    initData: string,
  ): TelegramUser & { chatId?: string } {
    const botToken = this.getBotToken();

    // Dev fallback if bot token is not configured
    if (!botToken) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN is not configured. Parsing initData in development fallback mode.',
      );
      return this.parseUserFromInitData(initData);
    }

    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');

      if (!hash) {
        throw new UnauthorizedException('Missing hash in Telegram initData');
      }

      urlParams.delete('hash');

      // Sort alphabetically: key=value pairs joined by \n
      const keys = Array.from(urlParams.keys()).sort();
      const dataCheckString = keys
        .map((key) => `${key}=${urlParams.get(key)}`)
        .join('\n');

      // secret_key = HMAC_SHA256("WebAppData", botToken)
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      // calculated_hash = HMAC_SHA256(dataCheckString, secret_key)
      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      const isMatch = crypto.timingSafeEqual(
        Buffer.from(calculatedHash, 'hex'),
        Buffer.from(hash, 'hex'),
      );

      if (!isMatch) {
        throw new UnauthorizedException(
          'Telegram initData signature verification failed',
        );
      }

      const userJson = urlParams.get('user');
      if (!userJson) {
        throw new BadRequestException(
          'No user information found in Telegram initData',
        );
      }

      const parsedUser = JSON.parse(userJson) as TelegramUser;
      const chatId = urlParams.get('chat_instance') || String(parsedUser.id);
      return { ...parsedUser, chatId };
    } catch (err: any) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      this.logger.error(`Validation error: ${err.message}`);
      throw new UnauthorizedException(
        'Invalid Telegram authentication credentials',
      );
    }
  }

  private parseUserFromInitData(
    initData: string,
  ): TelegramUser & { chatId?: string } {
    const urlParams = new URLSearchParams(initData);
    const userJson = urlParams.get('user');
    if (!userJson) {
      // Direct mock payload support for testing
      try {
        const parsed = JSON.parse(initData);
        if (parsed.id) return { ...parsed, chatId: String(parsed.id) };
      } catch (err: any) {
        this.logger.debug(`Direct JSON parse fallback failed: ${err?.message}`);
      }
      throw new BadRequestException('Invalid initData format');
    }
    const parsed = JSON.parse(userJson) as TelegramUser;
    return { ...parsed, chatId: String(parsed.id) };
  }

  /**
   * Authenticates a Telegram user.
   * If customer account exists: checks status (ACTIVE, PENDING, REJECTED, SUSPENDED, BLOCKED).
   * If no account exists: returns { status: 'REGISTRATION_REQUIRED', telegramUser }.
   */
  async authenticateTelegramCustomer(initData: string) {
    const telegramUser = this.validateTelegramInitData(initData);
    const telegramUserId = String(telegramUser.id);

    const account = await this.accountRepo.findOne({
      where: { telegramUserId },
      relations: { customer: true },
    });

    if (!account) {
      // First-time customer: registration required
      return {
        status: 'REGISTRATION_REQUIRED',
        message:
          'No customer account found for this Telegram account. Please register.',
        telegramUser: {
          id: telegramUser.id,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name || null,
          username: telegramUser.username || null,
        },
      };
    }

    const customer = account.customer;

    // Update account metadata if changed
    let accountUpdated = false;
    if (
      telegramUser.username &&
      account.telegramUsername !== telegramUser.username
    ) {
      account.telegramUsername = telegramUser.username;
      accountUpdated = true;
    }
    if (
      telegramUser.first_name &&
      account.firstName !== telegramUser.first_name
    ) {
      account.firstName = telegramUser.first_name;
      accountUpdated = true;
    }
    if (account.lastName !== (telegramUser.last_name || null)) {
      account.lastName = telegramUser.last_name || null;
      accountUpdated = true;
    }
    if (telegramUser.chatId && account.telegramChatId !== telegramUser.chatId) {
      account.telegramChatId = telegramUser.chatId;
      accountUpdated = true;
    }
    if (accountUpdated) {
      await this.accountRepo.save(account);
    }

    // Branch based on CustomerStatus
    switch (customer.status) {
      case CustomerStatus.ACTIVE: {
        return this.generateCustomerToken(customer, account);
      }

      case CustomerStatus.PENDING: {
        // Staff approval removed for registration: auto-activate legacy PENDING customers
        customer.status = CustomerStatus.ACTIVE;
        customer.isActive = true;
        customer.rejectionReason = null;
        await this.customerRepo.save(customer);
        this.logger.log(
          `Customer #${customer.id} auto-activated from PENDING -> ACTIVE on login.`,
        );
        return this.generateCustomerToken(customer, account);
      }

      case CustomerStatus.REJECTED: {
        return {
          status: CustomerStatus.REJECTED,
          message: 'Your registration was rejected.',
          rejectionReason: customer.rejectionReason || 'No reason provided',
          customer: {
            id: customer.id,
            companyName: customer.companyName,
            contactName: customer.contactName,
            phone: customer.phone,
            address: customer.address,
            status: customer.status,
            rejectionReason: customer.rejectionReason,
          },
        };
      }

      case CustomerStatus.SUSPENDED: {
        return {
          status: CustomerStatus.SUSPENDED,
          message:
            'Your account is currently suspended. Please contact our staff.',
        };
      }

      case CustomerStatus.BLOCKED: {
        return {
          status: CustomerStatus.BLOCKED,
          message:
            'Your account is blocked. You cannot access the ordering system.',
        };
      }

      default: {
        return {
          status: customer.status,
          message: `Customer account status is ${customer.status}.`,
        };
      }
    }
  }

  /**
   * Helper to generate customer JWT payload and return standard active auth response.
   */
  async generateCustomerToken(
    customer: Customer,
    account: CustomerTelegramAccount,
  ) {
    const payload = {
      sub: customer.id,
      telegramAccountId: account.id,
      telegramUserId: account.telegramUserId,
      role: 'CUSTOMER',
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return {
      status: CustomerStatus.ACTIVE,
      accessToken,
      customer: {
        id: customer.id,
        companyName: customer.companyName,
        contactName: customer.contactName,
        phone: customer.phone,
        address: customer.address,
        latitude: customer.latitude != null ? Number(customer.latitude) : null,
        longitude: customer.longitude != null ? Number(customer.longitude) : null,
        province: customer.province || null,
        district: customer.district || null,
        commune: customer.commune || null,
        status: customer.status,
        telegramUserId: account.telegramUserId,
        telegramUsername: account.telegramUsername,
        firstName: account.firstName,
        lastName: account.lastName,
      },
    };
  }

  /**
   * Registers a customer account with strong duplicate protection and idempotency.
   * Auto-activates customer account so they can immediately browse and place orders.
   */
  async registerCustomer(dto: CustomerRegisterDto) {
    const telegramUser = this.validateTelegramInitData(dto.initData);
    const telegramUserId = String(telegramUser.id);
    const chatId = telegramUser.chatId || String(telegramUser.id);

    const normalizedPhone = normalizePhoneNumber(dto.phone);
    const companyName = dto.companyName.trim();
    const contactName = dto.contactName.trim();
    const address = dto.address.trim();

    const latitude =
      typeof dto.latitude === 'number' && !isNaN(dto.latitude)
        ? Number(dto.latitude)
        : null;
    const longitude =
      typeof dto.longitude === 'number' && !isNaN(dto.longitude)
        ? Number(dto.longitude)
        : null;
    const province = dto.province?.trim() || null;
    const district = dto.district?.trim() || null;
    const commune = dto.commune?.trim() || null;

    return this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Check if Telegram account already exists
      const existingAccount = await manager.findOne(CustomerTelegramAccount, {
        where: { telegramUserId },
        relations: { customer: true },
      });

      if (existingAccount) {
        const existingCustomer = existingAccount.customer;

        // If existing is REJECTED -> update info and activate customer
        if (existingCustomer.status === CustomerStatus.REJECTED) {
          existingCustomer.companyName = companyName;
          existingCustomer.contactName = contactName;
          existingCustomer.phone = normalizedPhone;
          existingCustomer.address = address;
          existingCustomer.latitude = latitude;
          existingCustomer.longitude = longitude;
          existingCustomer.province = province;
          existingCustomer.district = district;
          existingCustomer.commune = commune;
          existingCustomer.status = CustomerStatus.ACTIVE;
          existingCustomer.rejectionReason = null;
          existingCustomer.isActive = true;

          await manager.save(Customer, existingCustomer);

          // Update Telegram account details
          existingAccount.telegramChatId = chatId;
          existingAccount.telegramUsername =
            telegramUser.username || existingAccount.telegramUsername;
          existingAccount.firstName =
            telegramUser.first_name || existingAccount.firstName;
          existingAccount.lastName =
            telegramUser.last_name || existingAccount.lastName;
          await manager.save(CustomerTelegramAccount, existingAccount);

          this.logger.log(
            `Customer #${existingCustomer.id} re-registered from REJECTED -> ACTIVE.`,
          );
          const tokenRes = await this.generateCustomerToken(
            existingCustomer,
            existingAccount,
          );
          return {
            ...tokenRes,
            message:
              'Your registration information has been updated. Welcome back!',
          };
        }

        // If existing is ACTIVE -> return existing active credentials (idempotent login)
        if (existingCustomer.status === CustomerStatus.ACTIVE) {
          this.logger.log(
            `Idempotent registration: Telegram user ${telegramUserId} already has active customer #${existingCustomer.id}.`,
          );
          const tokenRes = await this.generateCustomerToken(
            existingCustomer,
            existingAccount,
          );
          return {
            ...tokenRes,
            message: 'You are already registered and your account is active.',
          };
        }

        // If existing is PENDING -> auto-activate to ACTIVE immediately (staff approval removed)
        if (existingCustomer.status === CustomerStatus.PENDING) {
          existingCustomer.status = CustomerStatus.ACTIVE;
          existingCustomer.isActive = true;
          existingCustomer.rejectionReason = null;
          await manager.save(Customer, existingCustomer);

          this.logger.log(
            `Customer #${existingCustomer.id} auto-activated from PENDING -> ACTIVE upon registration.`,
          );
          const tokenRes = await this.generateCustomerToken(
            existingCustomer,
            existingAccount,
          );
          return {
            ...tokenRes,
            message: 'Your account is active. Welcome!',
          };
        }

        // Idempotent: Return existing status for SUSPENDED, BLOCKED
        this.logger.log(
          `Idempotent registration: Telegram user ${telegramUserId} already has customer #${existingCustomer.id} (${existingCustomer.status}).`,
        );
        return {
          status: existingCustomer.status,
          message: `Your account is currently in ${existingCustomer.status} status.`,
          rejectionReason: existingCustomer.rejectionReason,
          customer: existingCustomer,
        };
      }

      // 2. Duplicate phone check (Flag for staff review, do NOT silently merge)
      const phoneDuplicate = await manager.findOne(Customer, {
        where: { phone: normalizedPhone },
      });
      if (phoneDuplicate) {
        this.logger.warn(
          `[DUPLICATE WARNING] Registering customer has phone "${normalizedPhone}" already used by customer #${phoneDuplicate.id} ("${phoneDuplicate.companyName}"). Requires staff review.`,
        );
      }

      // 3. Duplicate company check (Flag for staff review, do NOT silently merge)
      const allCustomers = await manager.find(Customer, {
        select: { id: true, companyName: true },
      });
      const targetNorm = normalizeCompanyName(companyName);
      const companyDuplicate = allCustomers.find(
        (c) =>
          c.companyName && normalizeCompanyName(c.companyName) === targetNorm,
      );
      if (companyDuplicate) {
        this.logger.warn(
          `[DUPLICATE WARNING] Registering customer company "${companyName}" matches existing customer #${companyDuplicate.id} ("${companyDuplicate.companyName}"). Requires staff review.`,
        );
      }

      // 4. Create customer and telegram account inside transaction with auto-activation (ACTIVE)
      try {
        const customer = manager.create(Customer, {
          companyName,
          contactName,
          phone: normalizedPhone,
          address,
          latitude,
          longitude,
          province,
          district,
          commune,
          status: CustomerStatus.ACTIVE,
          rejectionReason: null,
          isActive: true,
        });
        const savedCustomer = await manager.save(Customer, customer);

        const account = manager.create(CustomerTelegramAccount, {
          customerId: savedCustomer.id,
          telegramUserId,
          telegramChatId: chatId,
          telegramUsername: telegramUser.username || null,
          firstName: telegramUser.first_name || 'Customer',
          lastName: telegramUser.last_name || null,
        });
        await manager.save(CustomerTelegramAccount, account);

        this.logger.log(
          `New customer registration created: #${savedCustomer.id} (ACTIVE).`,
        );
        const tokenRes = await this.generateCustomerToken(
          savedCustomer,
          account,
        );
        return {
          ...tokenRes,
          message: 'Registration successful! Welcome to the store.',
        };
      } catch (err: any) {
        // Concurrency protection: catch DB unique constraint error on telegram_user_id
        if (
          err?.code === '23505' ||
          err?.message?.includes('duplicate key') ||
          err?.message?.includes('UQ_')
        ) {
          this.logger.warn(
            `Concurrent registration caught for telegram_user_id ${telegramUserId}. Loading existing account.`,
          );
          const concurrentAccount = await manager.findOne(
            CustomerTelegramAccount,
            {
              where: { telegramUserId },
              relations: { customer: true },
            },
          );

          if (concurrentAccount) {
            if (concurrentAccount.customer.status === CustomerStatus.ACTIVE) {
              return this.generateCustomerToken(
                concurrentAccount.customer,
                concurrentAccount,
              );
            }
            if (concurrentAccount.customer.status === CustomerStatus.PENDING) {
              concurrentAccount.customer.status = CustomerStatus.ACTIVE;
              concurrentAccount.customer.isActive = true;
              concurrentAccount.customer.rejectionReason = null;
              await manager.save(Customer, concurrentAccount.customer);
              return this.generateCustomerToken(
                concurrentAccount.customer,
                concurrentAccount,
              );
            }
            return {
              status: concurrentAccount.customer.status,
              message: 'Registration already received.',
              customer: concurrentAccount.customer,
            };
          }
        }
        throw err;
      }
    });
  }

  // ========================================================
  // STAFF APPROVAL & SEARCH ACTIONS
  // ========================================================

  /** Search customers for staff order creation. */
  async searchCustomersForStaff(queryText?: string) {
    if (!queryText || !queryText.trim()) {
      return [];
    }

    const trimmed = queryText.trim();
    const usernameQuery = trimmed.startsWith('@')
      ? trimmed.slice(1).trim()
      : trimmed;
    const phoneQuery = normalizePhoneNumber(trimmed);

    const qb = this.customerRepo
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.telegramAccounts', 'telegramAccounts')
      .where(
        '(LOWER(customer.companyName) LIKE :search ' +
          'OR LOWER(customer.contactName) LIKE :search ' +
          'OR customer.phone LIKE :search ' +
          'OR customer.phone LIKE :phoneSearch ' +
          'OR LOWER(customer.firstName) LIKE :search ' +
          'OR LOWER(customer.lastName) LIKE :search ' +
          'OR LOWER(telegramAccounts.telegramUsername) = :exactUsername ' +
          'OR LOWER(telegramAccounts.telegramUsername) LIKE :searchUsername ' +
          'OR telegramAccounts.telegramUserId = :exactId)',
        {
          search: `%${trimmed.toLowerCase()}%`,
          phoneSearch: `%${phoneQuery}%`,
          exactUsername: usernameQuery.toLowerCase(),
          searchUsername: `%${usernameQuery.toLowerCase()}%`,
          exactId: trimmed,
        },
      )
      .orderBy('customer.createdAt', 'DESC')
      .take(20);

    const customers = await qb.getMany();

    return customers.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      contactName: c.contactName,
      phone: c.phone,
      address: c.address,
      status: c.status,
      isActive: c.isActive,
      canOrder: c.status === CustomerStatus.ACTIVE,
      telegramAccounts: (c.telegramAccounts || []).map((acc) => ({
        id: acc.id,
        telegramUserId: acc.telegramUserId,
        telegramChatId: acc.telegramChatId,
        telegramUsername: acc.telegramUsername,
        firstName: acc.firstName,
        lastName: acc.lastName,
      })),
      createdAt: c.createdAt,
    }));
  }

  async findAllCustomersForStaff(query: CustomerQueryDto) {
    const qb = this.customerRepo
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.telegramAccounts', 'telegramAccounts')
      .orderBy('customer.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('customer.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      qb.andWhere(
        '(LOWER(customer.companyName) LIKE :s OR LOWER(customer.contactName) LIKE :s OR customer.phone LIKE :s)',
        { s: `%${query.search.trim().toLowerCase()}%` },
      );
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);

    qb.skip((page - 1) * limit).take(limit);

    const [items, totalItems] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      },
    };
  }

  async approveCustomer(customerId: string, staffId: string) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
      relations: { telegramAccounts: true },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    customer.status = CustomerStatus.ACTIVE;
    customer.isActive = true;
    customer.rejectionReason = null;
    const saved = await this.customerRepo.save(customer);

    this.logger.log(
      `Customer #${customer.id} approved by staff #${staffId}. Status -> ACTIVE.`,
    );

    // Send Telegram Notification (Rule 11)
    if (customer.telegramAccounts && customer.telegramAccounts.length > 0) {
      for (const acc of customer.telegramAccounts) {
        if (acc.telegramChatId) {
          await this.telegramBotService.notifyCustomerApproved(
            acc.telegramChatId,
            customer.companyName || undefined,
          );
        }
      }
    }

    return {
      success: true,
      message: 'Customer approved successfully.',
      customer: saved,
    };
  }

  async rejectCustomer(customerId: string, staffId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('A rejection reason is required.');
    }

    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
      relations: { telegramAccounts: true },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    customer.status = CustomerStatus.REJECTED;
    customer.isActive = false;
    customer.rejectionReason = reason.trim();
    const saved = await this.customerRepo.save(customer);

    this.logger.log(
      `Customer #${customer.id} rejected by staff #${staffId}. Reason: "${reason.trim()}".`,
    );

    // Send Telegram Notification (Rule 11)
    if (customer.telegramAccounts && customer.telegramAccounts.length > 0) {
      for (const acc of customer.telegramAccounts) {
        if (acc.telegramChatId) {
          await this.telegramBotService.notifyCustomerRejected(
            acc.telegramChatId,
            reason.trim(),
          );
        }
      }
    }

    return {
      success: true,
      message: 'Customer registration rejected.',
      customer: saved,
    };
  }

  /**
   * Reverse geocodes latitude & longitude into human-readable address & admin details.
   */
  async reverseGeocode(lat: number, lng: number) {
    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new BadRequestException(
        'Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.',
      );
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'StockManagementAPI/1.0 (contact@stockmanagement.local)',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Geocoding provider responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      const addr = data.address || {};

      const province = addr.state || addr.province || addr.city || null;
      const district =
        addr.city_district ||
        addr.district ||
        addr.county ||
        addr.town ||
        null;
      const commune =
        addr.quarter ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.village ||
        null;

      return {
        formattedAddress: data.display_name || `${lat}, ${lng}`,
        latitude: lat,
        longitude: lng,
        province,
        district,
        commune,
      };
    } catch (err: any) {
      this.logger.warn(`Reverse geocoding failed: ${err.message}`);
      return {
        formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        latitude: lat,
        longitude: lng,
        province: null,
        district: null,
        commune: null,
      };
    }
  }

  /**
   * Searches places/addresses using OpenStreetMap Nominatim.
   */
  async searchLocation(query: string) {
    const q = query?.trim();
    if (!q || q.length < 2) {
      return [];
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q,
      )}&limit=5&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'StockManagementAPI/1.0 (contact@stockmanagement.local)',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Search provider responded with HTTP ${res.status}`);
      }

      const list = await res.json();
      if (!Array.isArray(list)) return [];

      return list.map((item: any) => {
        const addr = item.address || {};
        return {
          displayName: item.display_name,
          latitude: Number(item.lat),
          longitude: Number(item.lon),
          province: addr.state || addr.province || addr.city || null,
          district:
            addr.city_district ||
            addr.district ||
            addr.county ||
            addr.town ||
            null,
          commune:
            addr.quarter ||
            addr.suburb ||
            addr.neighbourhood ||
            addr.village ||
            null,
        };
      });
    } catch (err: any) {
      this.logger.warn(`Place search failed: ${err.message}`);
      return [];
    }
  }
}
