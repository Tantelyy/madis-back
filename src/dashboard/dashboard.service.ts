import { Injectable } from '@nestjs/common';
import { CartStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfitabilityQueryDto } from './dto/profitability-query.dto';
import { SalesStockQueryDto } from './dto/sales-stock-query.dto';
import type {
  ProfitabilityAmounts,
  ProfitabilityStatistics,
} from './interfaces/profitability.interface';
import type {
  SalesStockAnalysis,
  SalesStockItem,
} from './interfaces/sales-stock.interface';
import type {
  StockFinancialValue,
  StockValueByProductType,
} from './interfaces/stock-value.interface';
import { parseDashboardPeriod } from './utils/dashboard-period.util';
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

interface MutableStockValueByProductType {
  productTypeId: number;
  productType: string;
  value: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfitability(
    query: ProfitabilityQueryDto,
  ): Promise<ProfitabilityStatistics> {
    const { from, to } = parseDashboardPeriod(query);

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

  async getSalesStockAnalysis(
    query: SalesStockQueryDto,
  ): Promise<SalesStockAnalysis> {
    const { from, to } = parseDashboardPeriod(query);
    const productWhere: Prisma.ProductWhereInput = {
      deletedAt: null,
      productTypeId: query.productTypeId,
    };
    const [products, salesByInventory] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: productWhere,
        select: {
          id: true,
          name: true,
          productTypeId: true,
          productType: { select: { type: true } },
          inventories: {
            select: { id: true, remainingQuantity: true },
          },
        },
      }),
      this.prisma.cartDetail.groupBy({
        by: ['inventoryId'],
        orderBy: { inventoryId: 'asc' },
        where: {
          cart: {
            status: CartStatus.PAID,
            createdAt: { gte: from, lt: to },
          },
          inventory: { product: productWhere },
        },
        _sum: { quantity: true },
      }),
    ]);
    const productIdByInventoryId = new Map<number, number>();

    for (const product of products) {
      for (const inventory of product.inventories) {
        productIdByInventoryId.set(inventory.id, product.id);
      }
    }

    const soldQuantityByProductId = new Map<number, number>();

    for (const sale of salesByInventory) {
      const productId = productIdByInventoryId.get(sale.inventoryId);

      if (productId !== undefined) {
        soldQuantityByProductId.set(
          productId,
          (soldQuantityByProductId.get(productId) ?? 0) +
            (sale._sum?.quantity ?? 0),
        );
      }
    }

    const items = products.map<SalesStockItem>((product) => ({
      productId: product.id,
      productName: product.name,
      productTypeId: product.productTypeId,
      productType: product.productType.type,
      soldQuantity: soldQuantityByProductId.get(product.id) ?? 0,
      currentStock: product.inventories.reduce(
        (total, inventory) => total + inventory.remainingQuantity,
        0,
      ),
    }));

    items.sort(
      (first, second) =>
        second.soldQuantity - first.soldQuantity ||
        first.productName.localeCompare(second.productName, 'fr', {
          sensitivity: 'base',
        }) ||
        first.productId - second.productId,
    );

    const total = items.length;
    const skip = (query.page - 1) * query.limit;
    const maximumQuantity = items.reduce(
      (maximum, item) =>
        Math.max(maximum, item.soldQuantity, item.currentStock),
      1,
    );

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      stockAsOf: new Date().toISOString(),
      maximumQuantity,
      data: items.slice(skip, skip + query.limit),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getStockFinancialValue(): Promise<StockFinancialValue> {
    const inventories = await this.prisma.inventory.findMany({
      where: {
        remainingQuantity: { gt: 0 },
        product: { deletedAt: null },
      },
      select: {
        remainingQuantity: true,
        purchasePrice: true,
        product: {
          select: {
            productType: {
              select: { id: true, type: true },
            },
          },
        },
      },
    });
    const valuesByProductType = new Map<
      number,
      MutableStockValueByProductType
    >();

    for (const inventory of inventories) {
      const productType = inventory.product.productType;
      const currentValue = valuesByProductType.get(productType.id);
      const inventoryValue = inventory.purchasePrice.mul(
        inventory.remainingQuantity,
      );

      if (currentValue) {
        currentValue.value = currentValue.value.plus(inventoryValue);
      } else {
        valuesByProductType.set(productType.id, {
          productTypeId: productType.id,
          productType: productType.type,
          value: inventoryValue,
        });
      }
    }

    const values = [...valuesByProductType.values()].sort(
      (first, second) =>
        second.value.comparedTo(first.value) ||
        first.productType.localeCompare(second.productType, 'fr', {
          sensitivity: 'base',
        }) ||
        first.productTypeId - second.productTypeId,
    );
    const totalValue = values.reduce(
      (total, item) => total.plus(item.value),
      new Prisma.Decimal(0),
    );
    const byProductType = values.map<StockValueByProductType>((item) => ({
      productTypeId: item.productTypeId,
      productType: item.productType,
      value: item.value.toDecimalPlaces(2).toFixed(2),
      percentage: totalValue.equals(ZERO)
        ? '0.00'
        : item.value
            .dividedBy(totalValue)
            .times(100)
            .toDecimalPlaces(2)
            .toFixed(2),
    }));

    return {
      stockAsOf: new Date().toISOString(),
      totalValue: totalValue.toDecimalPlaces(2).toFixed(2),
      byProductType,
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
