import { Prisma, SpecialOfferType, SpecialOfferUnit } from '@prisma/client';

export interface PromotionCandidate {
  id: number;
  type: SpecialOfferType;
  value: Prisma.Decimal | null;
  unit: SpecialOfferUnit | null;
  buyQuantity: number | null;
  freeQuantity: number | null;
}

export interface AppliedSalePricing {
  specialOfferId: number | null;
  freeQuantity: number | null;
  baseUnitPrice: Prisma.Decimal;
  finalUnitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal | null;
  totalPrice: Prisma.Decimal;
  stockQuantity: number;
}

interface PromotionResult {
  offerId: number;
  freeQuantity: number | null;
  finalUnitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal | null;
  benefit: Prisma.Decimal;
}

export interface FreeQuantityPromotionAllocation {
  paidQuantity: number;
  freeQuantity: number;
}

const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

export function calculateFreeQuantityPromotionAllocation(
  requestedQuantity: number,
  promotionStock: number,
  buyQuantity: number,
  freeQuantity: number,
): FreeQuantityPromotionAllocation {
  if (
    requestedQuantity <= 0 ||
    promotionStock <= 0 ||
    buyQuantity <= 0 ||
    freeQuantity <= 0
  ) {
    return { paidQuantity: 0, freeQuantity: 0 };
  }

  const bundleCount = Math.min(
    Math.floor(requestedQuantity / buyQuantity),
    Math.floor(promotionStock / (buyQuantity + freeQuantity)),
  );

  return {
    paidQuantity: bundleCount * buyQuantity,
    freeQuantity: bundleCount * freeQuantity,
  };
}

export function calculateSalePricing(
  baseUnitPrice: Prisma.Decimal,
  quantity: number,
  offers: readonly PromotionCandidate[],
): AppliedSalePricing {
  const promotion = offers.reduce<PromotionResult | null>(
    (bestPromotion, offer) => {
      const candidate = calculatePromotion(baseUnitPrice, quantity, offer);

      if (!candidate || candidate.benefit.lessThanOrEqualTo(ZERO)) {
        return bestPromotion;
      }

      if (
        !bestPromotion ||
        candidate.benefit.greaterThan(bestPromotion.benefit)
      ) {
        return candidate;
      }

      return bestPromotion;
    },
    null,
  );

  const finalUnitPrice = promotion?.finalUnitPrice ?? baseUnitPrice;
  const freeQuantity = promotion?.freeQuantity ?? null;

  return {
    specialOfferId: promotion?.offerId ?? null,
    freeQuantity,
    baseUnitPrice,
    finalUnitPrice,
    discountAmount: promotion?.discountAmount ?? null,
    totalPrice: toMoney(finalUnitPrice.mul(quantity)),
    stockQuantity: quantity + (freeQuantity ?? 0),
  };
}

function calculatePromotion(
  baseUnitPrice: Prisma.Decimal,
  quantity: number,
  offer: PromotionCandidate,
): PromotionResult | null {
  if (offer.type === SpecialOfferType.REDUCTION) {
    return calculateReduction(baseUnitPrice, quantity, offer);
  }

  return calculateFreeQuantityOffer(baseUnitPrice, quantity, offer);
}

function calculateReduction(
  baseUnitPrice: Prisma.Decimal,
  quantity: number,
  offer: PromotionCandidate,
): PromotionResult | null {
  if (!offer.value || !offer.unit || offer.value.lessThanOrEqualTo(ZERO)) {
    return null;
  }

  const rawDiscount =
    offer.unit === SpecialOfferUnit.PERCENT
      ? baseUnitPrice.mul(offer.value).div(ONE_HUNDRED)
      : offer.value;
  const discountAmount = toMoney(
    rawDiscount.greaterThan(baseUnitPrice) ? baseUnitPrice : rawDiscount,
  );
  const finalUnitPrice = toMoney(baseUnitPrice.minus(discountAmount));

  return {
    offerId: offer.id,
    freeQuantity: null,
    finalUnitPrice,
    discountAmount,
    benefit: discountAmount.mul(quantity),
  };
}

function calculateFreeQuantityOffer(
  baseUnitPrice: Prisma.Decimal,
  quantity: number,
  offer: PromotionCandidate,
): PromotionResult | null {
  if (
    !offer.buyQuantity ||
    !offer.freeQuantity ||
    offer.buyQuantity <= 0 ||
    offer.freeQuantity <= 0
  ) {
    return null;
  }

  const freeQuantity =
    Math.floor(quantity / offer.buyQuantity) * offer.freeQuantity;

  if (freeQuantity === 0) {
    return null;
  }

  return {
    offerId: offer.id,
    freeQuantity,
    finalUnitPrice: baseUnitPrice,
    discountAmount: null,
    benefit: baseUnitPrice.mul(freeQuantity),
  };
}

function toMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2);
}
