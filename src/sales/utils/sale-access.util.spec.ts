import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { getRestrictedSellerId } from './sale-access.util';

function createUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 7,
    email: 'seller@example.com',
    role: 'SELLER',
    permissions: ['CAN_SELL'],
    ...overrides,
  };
}

describe('getRestrictedSellerId', () => {
  it('does not restrict an ADMIN to their own sales', () => {
    expect(
      getRestrictedSellerId(createUser({ role: 'ADMIN' })),
    ).toBeUndefined();
  });

  it('restricts a SELLER to their own sales', () => {
    expect(getRestrictedSellerId(createUser({ id: 42 }))).toBe(42);
  });

  it('restricts a permission-based non-ADMIN user to their own sales', () => {
    expect(
      getRestrictedSellerId(
        createUser({ role: 'MANAGER', permissions: ['ALL'] }),
      ),
    ).toBe(7);
  });
});
