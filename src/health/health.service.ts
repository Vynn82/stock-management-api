import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface DatabaseHealth {
  status: 'UP' | 'DOWN';
  latencyMs: number;
  version?: string;
  databaseSize?: string;
  activeConnections?: number;
  tableCount?: number;
  error?: string;
}

export interface SystemHealth {
  status: 'UP' | 'DOWN';
  timestamp: string;
  uptimeSeconds: number;
  uptimeFormatted: string;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  database: DatabaseHealth;
}

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async checkDatabase(): Promise<DatabaseHealth> {
    const startTime = Date.now();
    try {
      if (!this.dataSource.isInitialized) {
        return {
          status: 'DOWN',
          latencyMs: 0,
          error: 'DataSource is not initialized',
        };
      }

      // 1. Ping database with simple query
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - startTime;

      // 2. Fetch PostgreSQL version
      const [versionRow] = await this.dataSource.query('SELECT version()');
      const version = versionRow?.version?.split(' on ')[0] || 'Unknown';

      // 3. Fetch database size
      const [sizeRow] = await this.dataSource.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);

      // 4. Fetch active connection count
      const [connRow] = await this.dataSource.query(`
        SELECT count(*)::int as active_connections 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);

      // 5. Fetch table count
      const [tableRow] = await this.dataSource.query(`
        SELECT count(*)::int as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      return {
        status: 'UP',
        latencyMs,
        version,
        databaseSize: sizeRow?.size || 'Unknown',
        activeConnections: connRow?.active_connections ?? 1,
        tableCount: tableRow?.table_count ?? 0,
      };
    } catch (error: any) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - startTime,
        error: error.message || 'Database unreachable',
      };
    }
  }

  async checkSystem(): Promise<SystemHealth> {
    const dbHealth = await this.checkDatabase();
    const uptimeSec = Math.floor(process.uptime());
    const mem = process.memoryUsage();

    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

    return {
      status: dbHealth.status === 'UP' ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      uptimeSeconds: uptimeSec,
      uptimeFormatted,
      memory: {
        heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      database: dbHealth,
    };
  }
}
