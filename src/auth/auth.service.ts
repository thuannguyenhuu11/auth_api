import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from 'src/entity/user.entity';
import { AccessToken } from 'src/entity/access-token.entity';
import { RefreshToken } from 'src/entity/refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(AccessToken)
    private accessTokensRepository: Repository<AccessToken>,
    @InjectRepository(RefreshToken)
    private refreshTokensRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
  ) {}

  async register(
    username: string,
    password: string,
  ): Promise<{ message: string; user: User }> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      username,
      password: hashedPassword,
    });
    await this.usersRepository.save(user);
    return { message: 'User registered successfully', user };
  }

  async login(
    username: string,
    password: string,
  ): Promise<{ message: string; accessToken: string; refreshToken: string }> {
    const user = await this.usersRepository.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error('Invalid credentials');
    }

    const accessToken = this.jwtService.sign({ userId: user.id });
    const refreshToken = this.jwtService.sign(
      { userId: user.id },
      { expiresIn: '7d' },
    );

    await this.accessTokensRepository.save({ token: accessToken, user });
    await this.refreshTokensRepository.save({ token: refreshToken, user });

    return { message: 'Login successful', accessToken, refreshToken };
  }

  async logout(userId: number, token: string): Promise<{ message: string }> {
    await this.accessTokensRepository.delete({ token, user: { id: userId } });
    return { message: 'Logout successful' };
  }

  async refreshToken(
    oldRefreshToken: string,
  ): Promise<{ message: string; accessToken: string; refreshToken: string }> {
    const refreshTokenEntity = await this.refreshTokensRepository.findOne({
      where: { token: oldRefreshToken },
    });
    if (!refreshTokenEntity) {
      throw new Error('Invalid refresh token');
    }

    const user = refreshTokenEntity.user;
    const accessToken = this.jwtService.sign({ userId: user.id });
    const refreshToken = this.jwtService.sign(
      { userId: user.id },
      { expiresIn: '7d' },
    );

    await this.accessTokensRepository.save({ token: accessToken, user });
    await this.refreshTokensRepository.save({ token: refreshToken, user });

    return {
      message: 'Token refreshed successfully',
      accessToken,
      refreshToken,
    };
  }
}
