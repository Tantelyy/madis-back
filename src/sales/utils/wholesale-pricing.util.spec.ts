import {
  AUTOMATIC_WHOLESALE_MIN_QUANTITY,
  isManualWholesaleRequest,
  usesWholesalePrice,
} from './wholesale-pricing.util';

describe('usesWholesalePrice', () => {
  it('n applique pas automatiquement le prix de gros avant quatre unites', () => {
    expect(
      usesWholesalePrice(AUTOMATIC_WHOLESALE_MIN_QUANTITY - 1, false),
    ).toBe(false);
  });

  it('applique automatiquement le prix de gros a partir de quatre unites', () => {
    expect(usesWholesalePrice(AUTOMATIC_WHOLESALE_MIN_QUANTITY, false)).toBe(
      true,
    );
  });

  it('conserve une demande manuelle avant le seuil automatique', () => {
    expect(usesWholesalePrice(1, true)).toBe(true);
  });

  it('ne considere plus la case comme une demande manuelle au seuil automatique', () => {
    expect(
      isManualWholesaleRequest(AUTOMATIC_WHOLESALE_MIN_QUANTITY, true),
    ).toBe(false);
  });
});
