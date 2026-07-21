import { Prisma, SpecialOfferType, SpecialOfferUnit } from '@prisma/client';
import {
  calculateFreeQuantityPromotionAllocation,
  calculateSalePricing,
  PromotionCandidate,
} from './promotion-calculator.util';

function createOffer(
  overrides: Partial<PromotionCandidate>,
): PromotionCandidate {
  return {
    id: 1,
    type: SpecialOfferType.REDUCTION,
    value: new Prisma.Decimal(10),
    unit: SpecialOfferUnit.PERCENT,
    buyQuantity: null,
    freeQuantity: null,
    ...overrides,
  };
}

describe('calculateSalePricing', () => {
  it('keeps the base price when no promotion applies', () => {
    const pricing = calculateSalePricing(new Prisma.Decimal(1000), 2, []);

    expect(pricing.specialOfferId).toBeNull();
    expect(pricing.finalUnitPrice.toFixed(2)).toBe('1000.00');
    expect(pricing.discountAmount).toBeNull();
    expect(pricing.totalPrice.toFixed(2)).toBe('2000.00');
    expect(pricing.stockQuantity).toBe(2);
  });

  it('applies a percentage reduction', () => {
    const pricing = calculateSalePricing(new Prisma.Decimal(1000), 2, [
      createOffer({ value: new Prisma.Decimal(25) }),
    ]);

    expect(pricing.specialOfferId).toBe(1);
    expect(pricing.discountAmount?.toFixed(2)).toBe('250.00');
    expect(pricing.finalUnitPrice.toFixed(2)).toBe('750.00');
    expect(pricing.totalPrice.toFixed(2)).toBe('1500.00');
  });

  it('caps a fixed reduction at the base unit price', () => {
    const pricing = calculateSalePricing(new Prisma.Decimal(500), 1, [
      createOffer({
        value: new Prisma.Decimal(700),
        unit: SpecialOfferUnit.FIXED,
      }),
    ]);

    expect(pricing.discountAmount?.toFixed(2)).toBe('500.00');
    expect(pricing.finalUnitPrice.toFixed(2)).toBe('0.00');
    expect(pricing.totalPrice.toFixed(2)).toBe('0.00');
  });

  it('adds free units to the stock output for BUY_X_GET_N', () => {
    const pricing = calculateSalePricing(new Prisma.Decimal(1200), 5, [
      createOffer({
        type: SpecialOfferType.BUY_X_GET_N,
        value: null,
        unit: null,
        buyQuantity: 2,
        freeQuantity: 1,
      }),
    ]);

    expect(pricing.freeQuantity).toBe(2);
    expect(pricing.stockQuantity).toBe(7);
    expect(pricing.totalPrice.toFixed(2)).toBe('6000.00');
  });

  it('selects the promotion with the greatest customer benefit', () => {
    const pricing = calculateSalePricing(new Prisma.Decimal(1000), 4, [
      createOffer({ id: 1, value: new Prisma.Decimal(10) }),
      createOffer({
        id: 2,
        type: SpecialOfferType.BUY_X_GET_N,
        value: null,
        unit: null,
        buyQuantity: 2,
        freeQuantity: 1,
      }),
    ]);

    expect(pricing.specialOfferId).toBe(2);
    expect(pricing.freeQuantity).toBe(2);
  });
});

describe('calculateFreeQuantityPromotionAllocation', () => {
  it('disables BUY_X_GET_N when the promotion stock cannot cover one bundle', () => {
    const allocation = calculateFreeQuantityPromotionAllocation(2, 2, 2, 1);

    expect(allocation).toEqual({ paidQuantity: 0, freeQuantity: 0 });
  });

  it('limits BUY_X_GET_N bundles to the remaining promotion stock', () => {
    const allocation = calculateFreeQuantityPromotionAllocation(6, 7, 2, 1);

    expect(allocation).toEqual({ paidQuantity: 4, freeQuantity: 2 });
  });
});
