import { BadRequestException, Injectable } from '@nestjs/common';
import { CartStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfitabilityQueryDto } from './dto/profitability-query.dto';
import type {
  ProfitabilityAmounts,
  ProfitabilityStatistics,
} from './interfaces/profitability.interface';
import {
  buildProfitabilityBuckets,
  findBucketIndex,
  resolveProfitabilityGranularity,
} from './utils/profitability-period.util';

interface MutableProfitabilityAmounts {
  purchaseAmount: Prisma.Decimal;
  revenue: Prisma.Decimal;
  costOfGoodsSold: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfitability(
    query: ProfitabilityQueryDto,
  ): Promise<ProfitabilityStatistics> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (from >= to) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début.',
      );
    }

    const granularity = resolveProfitabilityGranularity(
      from,
      to,
      query.timezoneOffset,
    );
    const buckets = buildProfitabilityBuckets(
      from,
      to,
      query.timezoneOffset,
      granularity,
    );
    const [inventories, paidSales] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: {
          createdAt: true,
          quantity: true,
          purchasePrice: true,
        },
      }),
      this.prisma.cart.findMany({
        where: {
          createdAt: { gte: from, lt: to },
          status: CartStatus.PAID,
        },
        select: {
          createdAt: true,
          cartDetails: {
            select: {
              quantity: true,
              finalUnitPrice: true,
              inventory: {
                select: { purchasePrice: true },
              },
            },
          },
        },
      }),
    ]);
    const valuesByBucket = buckets.map<MutableProfitabilityAmounts>(() => ({
      purchaseAmount: new Prisma.Decimal(0),
      revenue: new Prisma.Decimal(0),
      costOfGoodsSold: new Prisma.Decimal(0),
    }));

    for (const inventory of inventories) {
      const bucketIndex = findBucketIndex(buckets, inventory.createdAt);

      if (bucketIndex >= 0) {
        valuesByBucket[bucketIndex].purchaseAmount = valuesByBucket[
          bucketIndex
        ].purchaseAmount.plus(inventory.purchasePrice.mul(inventory.quantity));
      }
    }

    for (const sale of paidSales) {
      const bucketIndex = findBucketIndex(buckets, sale.createdAt);

      if (bucketIndex < 0) {
        continue;
      }

      for (const detail of sale.cartDetails) {
        valuesByBucket[bucketIndex].revenue = valuesByBucket[
          bucketIndex
        ].revenue.plus(detail.finalUnitPrice.mul(detail.quantity));
        valuesByBucket[bucketIndex].costOfGoodsSold = valuesByBucket[
          bucketIndex
        ].costOfGoodsSold.plus(
          // Une unité offerte sort du stock mais contribue à 0 Ar au coût
          // statistique demandé : seule la quantité facturée est comptée.
          detail.inventory.purchasePrice.mul(detail.quantity),
        );
      }
    }

    const points = buckets
      .map((bucket, index) => ({
        key: bucket.key,
        label: bucket.label,
        from: bucket.from.toISOString(),
        to: bucket.to.toISOString(),
        ...this.toResponseAmounts(valuesByBucket[index]),
      }))
      .filter(
        (point) =>
          granularity !== 'HOUR' ||
          point.purchaseAmount !== '0.00' ||
          point.revenue !== '0.00' ||
          point.costOfGoodsSold !== '0.00',
      );
    const totals = valuesByBucket.reduce<MutableProfitabilityAmounts>(
      (result, current) => ({
        purchaseAmount: result.purchaseAmount.plus(current.purchaseAmount),
        revenue: result.revenue.plus(current.revenue),
        costOfGoodsSold: result.costOfGoodsSold.plus(current.costOfGoodsSold),
      }),
      {
        purchaseAmount: new Prisma.Decimal(0),
        revenue: new Prisma.Decimal(0),
        costOfGoodsSold: new Prisma.Decimal(0),
      },
    );

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        granularity,
      },
      totals: this.toResponseAmounts(totals),
      points,
    };
  }

  private toResponseAmounts(
    amounts: MutableProfitabilityAmounts,
  ): ProfitabilityAmounts {
    const profit = amounts.revenue.minus(amounts.costOfGoodsSold);

    return {
      purchaseAmount: amounts.purchaseAmount.toDecimalPlaces(2).toFixed(2),
      revenue: amounts.revenue.toDecimalPlaces(2).toFixed(2),
      costOfGoodsSold: amounts.costOfGoodsSold.toDecimalPlaces(2).toFixed(2),
      profit: profit.equals(ZERO)
        ? '0.00'
        : profit.toDecimalPlaces(2).toFixed(2),
    };
  }
}
