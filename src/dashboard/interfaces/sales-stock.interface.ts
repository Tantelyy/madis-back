export interface SalesStockItem {
  productId: number;
  productName: string;
  productTypeId: number;
  productType: string;
  soldQuantity: number;
  currentStock: number;
}

export interface SalesStockAnalysis {
  period: {
    from: string;
    to: string;
  };
  stockAsOf: string;
  maximumQuantity: number;
  data: SalesStockItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
