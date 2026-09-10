import { SpecialOfferType, SpecialOfferUnit } from '@prisma/client';

export class SaleCatalogPromotionEntity {
  id!: number;
  type!: SpecialOfferType;
  value!: string | null;
  unit!: SpecialOfferUnit | null;
  buyQuantity!: number | null;
  freeQuantity!: number | null;
  productIdOffer!: number | null;
  productOfferName!: string | null;
}

export class SaleCatalogProductEntity {
  id!: number;
  name!: string;
  reference!: string;
  image!: string | null;
  retailPrice!: string | null;
  wholesalePrice!: string | null;
  baseRetailPrice!: string | null;
  baseWholesalePrice!: string | null;
  totalStock!: number;
  promotionStock!: number;
  hasPromotion!: boolean;
  promotionEndDate!: Date | null;
  promotion!: SaleCatalogPromotionEntity | null;
}
