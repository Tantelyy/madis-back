import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

export function getRestrictedSellerId(
  user: AuthenticatedUser,
): number | undefined {
  return user.role === 'ADMIN' ? undefined : user.id;
}
