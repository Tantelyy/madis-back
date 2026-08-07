export type ProfitabilityGranularity = 'HOUR' | 'WEEK' | 'MONTH';

export interface ProfitabilityAmounts {
  purchaseAmount: string;
  revenue: string;
  costOfGoodsSold: string;
  profit: string;
}

export interface ProfitabilityPoint extends ProfitabilityAmounts {
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface ProfitabilityStatistics {
  period: {
    from: string;
    to: string;
    granularity: ProfitabilityGranularity;
  };
  totals: ProfitabilityAmounts;
  points: ProfitabilityPoint[];
}
