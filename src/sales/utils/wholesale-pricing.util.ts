export const AUTOMATIC_WHOLESALE_MIN_QUANTITY = 4;

export function isManualWholesaleRequest(
  quantity: number,
  wholesaleRequested: boolean,
): boolean {
  return wholesaleRequested && quantity < AUTOMATIC_WHOLESALE_MIN_QUANTITY;
}

export function usesWholesalePrice(
  quantity: number,
  wholesaleRequested: boolean,
): boolean {
  return (
    isManualWholesaleRequest(quantity, wholesaleRequested) ||
    quantity >= AUTOMATIC_WHOLESALE_MIN_QUANTITY
  );
}
