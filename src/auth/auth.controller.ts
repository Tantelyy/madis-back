import { Body, Controller, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { AuthTokens } from './interfaces/auth-tokens.interface';
import type { LoginResponse } from './interfaces/login-response.interface';

const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const tokens = await this.authService.login(loginDto);
    this.setAuthCookies(response, tokens);

    return {
      message: 'Connexion réussie.',
    };
  }

  private setAuthCookies(response: Response, tokens: AuthTokens): void {
    response.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      tokens.accessToken,
      this.getAuthCookieOptions('JWT_ACCESS_EXPIRES_IN'),
    );
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      this.getAuthCookieOptions('JWT_REFRESH_EXPIRES_IN'),
    );
  }

  private getAuthCookieOptions(expiresInConfigKey: string): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'strict',
      path: '/',
      maxAge: this.parseDurationToMilliseconds(
        this.configService.getOrThrow<string>(expiresInConfigKey),
      ),
    };
  }

  private parseDurationToMilliseconds(duration: string): number {
    const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);

    if (!match) {
      throw new Error(`Invalid duration format for cookie maxAge: ${duration}`);
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
