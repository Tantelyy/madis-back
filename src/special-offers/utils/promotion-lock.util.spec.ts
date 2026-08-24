import { CartStatus } from '@prisma/client';
import { PROMOTION_LOCKING_CART_STATUSES } from './promotion-lock.util';

describe('PROMOTION_LOCKING_CART_STATUSES', () => {
  it('locks promotions used by an active sale workflow', () => {
    expect(PROMOTION_LOCKING_CART_STATUSES).toEqual([
      CartStatus.PENDING,
      CartStatus.VALIDATED,
      CartStatus.PAID,
      CartStatus.PARTIALLY_REFUNDED,
    ]);
  });

  it('does not lock promotions only used by reversed sales', () => {
    expect(PROMOTION_LOCKING_CART_STATUSES).not.toContain(CartStatus.CANCELLED);
    expect(PROMOTION_LOCKING_CART_STATUSES).not.toContain(CartStatus.REFUNDED);
  });

  it('locks promotions used by partially refunded sales', () => {
    expect(PROMOTION_LOCKING_CART_STATUSES).toContain(
      CartStatus.PARTIALLY_REFUNDED,
    );
  });
});
