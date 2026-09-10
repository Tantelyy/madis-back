export class StockLotEntity {
  id!: number;
  expiredAt!: Date | null;
  remainingQuantity!: number;
}

export class StockSummaryEntity {
  productId!: number;
  name!: string;
  reference!: string;
  remainingQuantity!: number;
  lots!: StockLotEntity[];
}
