import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: { find: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(UserRole), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: JwtService, useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() } },
        { provide: SessionsService, useValue: { createSession: jest.fn(), findSession: jest.fn() } },
        { provide: UsersService, useValue: { getMe: jest.fn(), findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
