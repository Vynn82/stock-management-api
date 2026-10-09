import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  const mockHealthService = {
    checkSystem: jest.fn().mockResolvedValue({
      status: 'UP',
      timestamp: '2026-10-05T00:00:00.000Z',
      uptimeSeconds: 120,
      uptimeFormatted: '0h 2m 0s',
      memory: { heapUsedMB: 50, heapTotalMB: 80, rssMB: 100 },
      database: {
        status: 'UP',
        latencyMs: 5,
        version: 'PostgreSQL 16',
        databaseSize: '10 MB',
        activeConnections: 2,
        tableCount: 28,
      },
    }),
    checkDatabase: jest.fn().mockResolvedValue({
      status: 'UP',
      latencyMs: 5,
      version: 'PostgreSQL 16',
      databaseSize: '10 MB',
      activeConnections: 2,
      tableCount: 28,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return system health when UP', async () => {
    const res = await controller.getSystemHealth();
    expect(res.status).toBe('UP');
    expect(res.database.status).toBe('UP');
  });

  it('should throw ServiceUnavailableException when system is DOWN', async () => {
    mockHealthService.checkSystem.mockResolvedValueOnce({
      status: 'DOWN',
      database: { status: 'DOWN', latencyMs: 0 },
    });
    await expect(controller.getSystemHealth()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should return database health when UP', async () => {
    const res = await controller.getDatabaseHealth();
    expect(res.status).toBe('UP');
    expect(res.latencyMs).toBe(5);
  });

  it('should throw ServiceUnavailableException when database is DOWN', async () => {
    mockHealthService.checkDatabase.mockResolvedValueOnce({
      status: 'DOWN',
      latencyMs: 0,
      error: 'Connection timeout',
    });
    await expect(controller.getDatabaseHealth()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
