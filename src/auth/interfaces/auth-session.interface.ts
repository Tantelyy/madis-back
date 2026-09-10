import type { AuthTokens } from './auth-tokens.interface';

export interface AuthenticatedUser {
  id: number;
  email: string;
  userName: string;
  role: string;
  permissions: string[];
}

export interface AuthSession {
  tokens: AuthTokens;
  user: AuthenticatedUser;
}
