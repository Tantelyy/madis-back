export interface LoginResponse {
  message: string;
  user: {
    id: number;
    email: string;
    userName: string;
    role: string;
    permissions: string[];
  };
}
