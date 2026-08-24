import { CartStatus } from '@prisma/client';

export const PROMOTION_LOCKING_CART_STATUSES = [
  CartStatus.PENDING,
  CartStatus.VALIDATED,
  CartStatus.PAID,
  CartStatus.PARTIALLY_REFUNDED,
] as const;
