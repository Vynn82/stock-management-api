import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async getSystemHealth() {
    const health = await this.healthService.checkSystem();
    if (health.status !== 'UP') {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }

  @Public()
  @Get('db')
  async getDatabaseHealth() {
    const dbHealth = await this.healthService.checkDatabase();
    if (dbHealth.status !== 'UP') {
      throw new ServiceUnavailableException(dbHealth);
    }
    return dbHealth;
  }
}
