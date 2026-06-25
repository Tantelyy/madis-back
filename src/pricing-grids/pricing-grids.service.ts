import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingGridEntity } from './entities/pricing-grid.entity';
import { PricingRuleEntity } from './entities/pricing-rule.entity';

const PRICING_GRID_INCLUDE = {
  pricingRules: {
    orderBy: {
      minPurchasePrice: 'asc',
    },
  },
} satisfies Prisma.PricingGridInclude;

type PricingGridPayload = Prisma.PricingGridGetPayload<{
  include: typeof PRICING_GRID_INCLUDE;
}>;

@Injectable()
export class PricingGridsService {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(): Promise<PricingGridEntity> {
    const pricingGrid = await this.prisma.pricingGrid.findFirst({
      where: {
        status: 'ACTIVE',
        effectiveFrom: {
          lte: new Date(),
        },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      include: PRICING_GRID_INCLUDE,
      orderBy: {
        effectiveFrom: 'desc',
      },
    });

    if (!pricingGrid) {
      throw new NotFoundException('Aucune grille de marge active.');
    }

    return this.mapPricingGrid(pricingGrid);
  }

  private mapPricingGrid(pricingGrid: PricingGridPayload): PricingGridEntity {
    return {
      id: pricingGrid.id,
      status: pricingGrid.status,
      effectiveFrom: pricingGrid.effectiveFrom,
      effectiveTo: pricingGrid.effectiveTo,
      createdAt: pricingGrid.createdAt,
      createdBy: pricingGrid.createdBy,
      updatedAt: pricingGrid.updatedAt,
      pricingRules: pricingGrid.pricingRules.map((pricingRule) =>
        this.mapPricingRule(pricingRule),
      ),
    };
  }

  private mapPricingRule(
    pricingRule: PricingGridPayload['pricingRules'][number],
  ): PricingRuleEntity {
    return {
      id: pricingRule.id,
      pricingGridId: pricingRule.pricingGridId,
      minPurchasePrice: pricingRule.minPurchasePrice,
      maxPurchasePrice: pricingRule.maxPurchasePrice,
      retailMarginPercent: pricingRule.retailMarginPercent.toFixed(2),
      wholesaleMarginPercent: pricingRule.wholesaleMarginPercent.toFixed(2),
      retailAverage: pricingRule.retailAverage.toFixed(2),
      wholesaleAverage: pricingRule.wholesaleAverage.toFixed(2),
    };
  }
}
