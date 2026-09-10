import { PricingGridStatus } from '@prisma/client';
import { PricingRuleEntity } from './pricing-rule.entity';

export class PricingGridEntity {
  id!: number;
  status!: PricingGridStatus;
  effectiveFrom!: Date;
  effectiveTo!: Date | null;
  createdAt!: Date;
  createdBy!: number;
  updatedAt!: Date;
  pricingRules!: PricingRuleEntity[];
}
