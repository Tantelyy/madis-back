import { buildInsufficientStockMessage } from './stock-message.util';

describe('buildInsufficientStockMessage', () => {
  it('identifie le produit et les quantites demandees et disponibles', () => {
    expect(buildInsufficientStockMessage('Produit test', 10, 3)).toBe(
      'Le stock disponible est insuffisant pour le produit « Produit test » : 10 unités demandées, 3 unités disponibles.',
    );
  });

  it('accorde les quantites au singulier', () => {
    expect(buildInsufficientStockMessage('Produit test', 1, 0)).toBe(
      'Le stock disponible est insuffisant pour le produit « Produit test » : 1 unité demandée, 0 unité disponible.',
    );
  });
});
