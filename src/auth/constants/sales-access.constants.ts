import type { AccessRequirements } from '../decorators/access.decorator';

export const SALES_ACCESS_REQUIREMENTS = {
  roles: ['ADMIN', 'SELLER'],
  permissions: ['CAN_SELL', 'ALL'],
} satisfies AccessRequirements;
