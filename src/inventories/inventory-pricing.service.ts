import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InventoryPriceValues } from './utils/inventory-write.util';

interface PricingRuleMargins {
  retailAverage: Prisma.Decimal;
  wholesaleAverage: Prisma.Decimal;
}

interface InventoryPriceFallback {
  salePrice: number;
  wholesalePrice: number;
}

@Injectable()
export class InventoryPricingService {
  async resolvePrices(
    purchasePrice: number,
    salePrice: number | undefined,
    wholesalePrice: number | undefined,
    tx: Prisma.TransactionClient,
    fallbackPrices?: InventoryPriceFallback,
  ): Promise<InventoryPriceValues> {
    if (salePrice !== undefined && wholesalePrice !== undefined) {
      return {
        purchasePrice: this.toDecimalPriceString(purchasePrice),
        salePrice: this.toRoundedPriceString(salePrice),
        wholesalePrice: this.toRoundedPriceString(wholesalePrice),
      };
    }

    if (
      fallbackPrices &&
      salePrice === undefined &&
      wholesalePrice === undefined
    ) {
      return {
        purchasePrice: this.toDecimalPriceString(purchasePrice),
        salePrice: this.toRoundedPriceString(fallbackPrices.salePrice),
        wholesalePrice: this.toRoundedPriceString(
          fallbackPrices.wholesalePrice,
        ),
      };
    }

    const pricingRule = await this.findPricingRuleForPurchasePrice(
      purchasePrice,
      tx,
    );

    return {
      purchasePrice: this.toDecimalPriceString(purchasePrice),
      salePrice: this.toRoundedPriceString(
        salePrice ?? purchasePrice + pricingRule.retailAverage.toNumber(),
      ),
      wholesalePrice: this.toRoundedPriceString(
        wholesalePrice ??
          purchasePrice + pricingRule.wholesaleAverage.toNumber(),
      ),
    };
  }

  async resolveImportedPrices(
    purchasePrice: number,
    salePrice: number | undefined,
    wholesalePrice: number | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryPriceValues> {
    if (salePrice !== undefined && wholesalePrice !== undefined) {
      return {
        purchasePrice: this.toDecimalPriceString(purchasePrice),
        salePrice: this.toDecimalPriceString(salePrice),
        wholesalePrice: this.toDecimalPriceString(wholesalePrice),
      };
    }

    const calculatedPrices = await this.resolvePrices(
      purchasePrice,
      salePrice,
      wholesalePrice,
      tx,
    );

    return {
      ...calculatedPrices,
      salePrice:
        salePrice === undefined
          ? calculatedPrices.salePrice
          : this.toDecimalPriceString(salePrice),
      wholesalePrice:
        wholesalePrice === undefined
          ? calculatedPrices.wholesalePrice
          : this.toDecimalPriceString(wholesalePrice),
    };
  }

  private async findPricingRuleForPurchasePrice(
    purchasePrice: number,
    tx: Prisma.TransactionClient,
  ): Promise<PricingRuleMargins> {
    const now = new Date();
    const pricingRule = await tx.pricingRule.findFirst({
      where: {
        minPurchasePrice: { lte: purchasePrice },
        maxPurchasePrice: { gte: purchasePrice },
        pricingGrid: {
          status: 'ACTIVE',
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
      },
      select: {
        retailAverage: true,
        wholesaleAverage: true,
      },
      orderBy: {
        minPurchasePrice: 'desc',
      },
    });

    if (!pricingRule) {
      throw new NotFoundException(
        "Aucune tranche de marge active ne correspond au prix d'achat.",
      );
    }

    return pricingRule;
  }

  private toDecimalPriceString(value: number): string {
    return value.toFixed(2);
  }

  private toRoundedPriceString(value: number): string {
    return Math.round(value).toFixed(2);
  }
}
