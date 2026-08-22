function formatUnitQuantity(quantity: number): string {
  return `${quantity} unité${quantity > 1 ? 's' : ''}`;
}

export function buildInsufficientStockMessage(
  productName: string,
  requestedQuantity: number,
  availableQuantity: number,
): string {
  return `Le stock disponible est insuffisant pour le produit « ${productName} » : ${formatUnitQuantity(requestedQuantity)} demandée${requestedQuantity > 1 ? 's' : ''}, ${formatUnitQuantity(availableQuantity)} disponible${availableQuantity > 1 ? 's' : ''}.`;
}
