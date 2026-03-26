import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jose from 'jose';
import { User } from '../entities/user.entity';
import { Profile } from '../entities/profile.entity';
import { UserRole } from '../entities/user-role.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  credits: number;
  roles: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwtSecret: Uint8Array;

  constructor(
    private config: ConfigService,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Profile) private profileRepo: Repository<Profile>,
    @InjectRepository(UserRole) private roleRepo: Repository<UserRole>,
  ) {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET not configured');
    this.jwtSecret = new TextEncoder().encode(secret);
  }

  async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const { payload } = await jose.jwtVerify(token, this.jwtSecret);
      return payload as unknown as JwtPayload;
    } catch (err: any) {
      this.logger.warn(`JWT verify failed: ${err.message}`);
      return null;
    }
  }

  async getUserFromToken(token: string): Promise<AuthenticatedUser | null> {
    const payload = await this.verifyToken(token);
    if (!payload?.sub) return null;

    const profile = await this.profileRepo.findOne({ where: { id: payload.sub } });
    if (!profile) return null;

    const roles = await this.roleRepo.find({ where: { userId: payload.sub } });

    return {
      id: payload.sub,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      credits: profile.credits,
      roles: roles.map((r) => r.role),
    };
  }
}
