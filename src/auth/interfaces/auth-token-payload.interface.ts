export interface AuthTokenPayload {
  sub: number;
  email: string;
  role: string;
  permissions: string[];
}
