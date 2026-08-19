export interface StockValueByProductType {
  productTypeId: number;
  productType: string;
  value: string;
  percentage: string;
}

export interface StockFinancialValue {
  stockAsOf: string;
  totalValue: string;
  byProductType: StockValueByProductType[];
}
