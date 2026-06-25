import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingRuleInputDto } from './dto/pricing-rule-input.dto';
import { UpdatePricingGridDto } from './dto/update-pricing-grid.dto';
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

  async updateActive(
    dto: UpdatePricingGridDto,
    userId: number,
  ): Promise<PricingGridEntity> {
    const pricingRuleInputs = this.normalizeAndValidatePricingRules(
      dto.pricingRules,
    );
    const now = new Date();

    const pricingGrid = await this.prisma.$transaction(async (tx) => {
      await tx.pricingGrid.updateMany({
        where: {
          status: 'ACTIVE',
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        data: {
          status: 'ARCHIVED',
          effectiveTo: now,
        },
      });

      return tx.pricingGrid.create({
        data: {
          status: 'ACTIVE',
          effectiveFrom: now,
          effectiveTo: null,
          createdBy: userId,
          pricingRules: {
            create: pricingRuleInputs.map((pricingRule) =>
              this.buildPricingRuleCreateInput(pricingRule),
            ),
          },
        },
        include: PRICING_GRID_INCLUDE,
      });
    });

    return this.mapPricingGrid(pricingGrid);
  }

  private normalizeAndValidatePricingRules(
    pricingRules: PricingRuleInputDto[],
  ): PricingRuleInputDto[] {
    const sortedPricingRules = [...pricingRules].sort(
      (firstRule, secondRule) =>
        firstRule.minPurchasePrice - secondRule.minPurchasePrice,
    );

    sortedPricingRules.forEach((pricingRule, index) => {
      if (pricingRule.maxPurchasePrice < pricingRule.minPurchasePrice) {
        throw new BadRequestException(
          'Chaque prix maximum doit etre superieur ou egal au prix minimum.',
        );
      }

      if (index === 0 && pricingRule.minPurchasePrice !== 0) {
        throw new BadRequestException(
          'La premiere tranche doit commencer au prix 0.',
        );
      }

      const previousRule = sortedPricingRules[index - 1];

      if (
        previousRule &&
        pricingRule.minPurchasePrice !== previousRule.maxPurchasePrice + 1
      ) {
        throw new BadRequestException(
          'Les tranches de prix ne doivent avoir aucun trou ni chevauchement.',
        );
      }
    });

    return sortedPricingRules;
  }

  private buildPricingRuleCreateInput(
    pricingRule: PricingRuleInputDto,
  ): Prisma.PricingRuleCreateWithoutPricingGridInput {
    return {
      minPurchasePrice: pricingRule.minPurchasePrice,
      maxPurchasePrice: pricingRule.maxPurchasePrice,
      retailMarginPercent: this.toTwoDecimalString(
        pricingRule.retailMarginPercent,
      ),
      wholesaleMarginPercent: this.toTwoDecimalString(
        pricingRule.wholesaleMarginPercent,
      ),
      retailAverage: this.calculateAverageMargin(
        pricingRule.minPurchasePrice,
        pricingRule.maxPurchasePrice,
        pricingRule.retailMarginPercent,
      ),
      wholesaleAverage: this.calculateAverageMargin(
        pricingRule.minPurchasePrice,
        pricingRule.maxPurchasePrice,
        pricingRule.wholesaleMarginPercent,
      ),
    };
  }

  private calculateAverageMargin(
    minPurchasePrice: number,
    maxPurchasePrice: number,
    marginPercent: number,
  ): string {
    const basePrice =
      minPurchasePrice === 0
        ? maxPurchasePrice
        : (minPurchasePrice + maxPurchasePrice) / 2;

    return this.toTwoDecimalString((basePrice * marginPercent) / 100);
  }

  private toTwoDecimalString(value: number): string {
    return value.toFixed(2);
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
