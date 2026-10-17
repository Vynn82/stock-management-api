import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { DataSource } from 'typeorm';

describe('HealthService', () => {
  let service: HealthService;

  const mockDataSource = {
    isInitialized: true,
    query: jest.fn().mockImplementation((q: string) => {
      if (q.includes('SELECT 1')) return Promise.resolve([{ '?column?': 1 }]);
      if (q.includes('SELECT version()'))
        return Promise.resolve([{ version: 'PostgreSQL 16.15' }]);
      if (q.includes('pg_size_pretty'))
        return Promise.resolve([{ size: '10 MB' }]);
      if (q.includes('pg_stat_activity'))
        return Promise.resolve([{ active_connections: 3 }]);
      if (q.includes('information_schema.tables'))
        return Promise.resolve([{ table_count: 28 }]);
      return Promise.resolve([]);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should report database as UP when queries succeed', async () => {
    const res = await service.checkDatabase();
    expect(res.status).toBe('UP');
    expect(res.version).toContain('PostgreSQL');
    expect(res.databaseSize).toBe('10 MB');
    expect(res.tableCount).toBe(28);
    expect(res.activeConnections).toBe(3);
  });

  it('should report database as DOWN when query throws error', async () => {
    mockDataSource.query.mockRejectedValueOnce(new Error('Connection lost'));
    const res = await service.checkDatabase();
    expect(res.status).toBe('DOWN');
    expect(res.error).toBe('Connection lost');
  });

  it('should report overall system health', async () => {
    const res = await service.checkSystem();
    expect(res.status).toBe('UP');
    expect(res.memory).toBeDefined();
    expect(res.database.status).toBe('UP');
  });
});
