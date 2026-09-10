export type ForecastStatus =
  | 'SUFFICIENT_STOCK'
  | 'STOCKOUT_EXPECTED'
  | 'OUT_OF_STOCK';

export interface ForecastItem {
  productId: number;
  productName: string;
  productReference: string;
  productTypeId: number;
  productType: string;
  asOfDate: string;
  forecastDays: number;
  currentStock: number;
  totalPredictedDemand: number;
  remainingStockAfterHorizon: number;
  status: ForecastStatus;
  predictedStockoutDate: string | null;
  daysUntilStockout: number | null;
}
