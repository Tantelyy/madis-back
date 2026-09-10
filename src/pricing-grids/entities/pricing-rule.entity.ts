export class PricingRuleEntity {
  id!: number;
  pricingGridId!: number;
  minPurchasePrice!: number;
  maxPurchasePrice!: number;
  retailMarginPercent!: string;
  wholesaleMarginPercent!: string;
  retailAverage!: string;
  wholesaleAverage!: string;
}
