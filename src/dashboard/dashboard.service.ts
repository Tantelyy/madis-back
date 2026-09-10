import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CartStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfitabilityQueryDto } from './dto/profitability-query.dto';
import { SalesStockQueryDto } from './dto/sales-stock-query.dto';
import { ForecastItem, ForecastStatus } from './interfaces/forecast.interface';
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
const DASHBOARD_SALE_STATUSES: readonly CartStatus[] = [
  CartStatus.PAID,
  CartStatus.PARTIALLY_REFUNDED,
];
const ML_FORECAST_BATCH_SIZE = 100;
const ML_BATCH_REQUEST_CONCURRENCY = 2;
const ML_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_ML_FORECAST_CACHE_TTL_MS = 30_000;

interface ForecastProduct {
  id: number;
  name: string;
  reference: string;
  productTypeId: number;
  productType: { type: string };
}

interface MlStockoutForecast {
  productId: number;
  asOfDate: string;
  forecastDays: number;
  currentStock: number;
  totalPredictedDemand: number;
  alreadyOutOfStock: boolean;
  stockoutExpected: boolean;
  predictedStockoutDate: string | null;
  daysUntilStockout: number | null;
  remainingStockAfterHorizon: number;
}

interface MlStockoutForecastBatchResponse {
  forecasts: MlStockoutForecast[];
}

interface ForecastCacheEntry {
  forecast: MlStockoutForecast;
  expiresAt: number;
}

@Injectable()
export class DashboardService {
  private readonly forecastCache = new Map<number, ForecastCacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {}

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
    const [inventories, sales] = await this.prisma.$transaction([
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
          status: { in: [...DASHBOARD_SALE_STATUSES] },
        },
        select: {
          createdAt: true,
          cartDetails: {
            select: {
              quantity: true,
              refundedQuantity: true,
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

    for (const sale of sales) {
      const bucketIndex = findBucketIndex(buckets, sale.createdAt);

      if (bucketIndex < 0) {
        continue;
      }

      for (const detail of sale.cartDetails) {
        const netPaidQuantity = this.getNetPaidQuantity(detail);

        valuesByBucket[bucketIndex].revenue = valuesByBucket[
          bucketIndex
        ].revenue.plus(detail.finalUnitPrice.mul(netPaidQuantity));
        valuesByBucket[bucketIndex].costOfGoodsSold = valuesByBucket[
          bucketIndex
        ].costOfGoodsSold.plus(
          // Une unité offerte sort du stock mais contribue à 0 Ar au coût
          // statistique demandé : seule la quantité facturée est comptée.
          detail.inventory.purchasePrice.mul(netPaidQuantity),
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
    const [products, saleDetails] = await this.prisma.$transaction([
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
      this.prisma.cartDetail.findMany({
        where: {
          cart: {
            status: { in: [...DASHBOARD_SALE_STATUSES] },
            createdAt: { gte: from, lt: to },
          },
          inventory: { product: productWhere },
        },
        select: {
          inventoryId: true,
          quantity: true,
          refundedQuantity: true,
        },
      }),
    ]);
    const productIdByInventoryId = new Map<number, number>();

    for (const product of products) {
      for (const inventory of product.inventories) {
        productIdByInventoryId.set(inventory.id, product.id);
      }
    }

    const soldQuantityByProductId = new Map<number, number>();

    for (const detail of saleDetails) {
      const productId = productIdByInventoryId.get(detail.inventoryId);

      if (productId !== undefined) {
        soldQuantityByProductId.set(
          productId,
          (soldQuantityByProductId.get(productId) ?? 0) +
            this.getNetPaidQuantity(detail),
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

  async getProductForecast(productId: number): Promise<ForecastItem> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: this.getForecastProductSelect(),
    });

    if (!product) {
      throw new NotFoundException('Le produit demandé est introuvable.');
    }

    const [forecast] = await this.getMlForecasts([product]);

    return this.toForecastItem(product, forecast);
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

  private async getMlForecasts(
    products: ForecastProduct[],
  ): Promise<MlStockoutForecast[]> {
    const requestedProductIds = products.map((product) => product.id);
    const now = Date.now();
    const cachedForecasts = new Map<number, MlStockoutForecast>();
    const missingProductIds: number[] = [];

    for (const productId of requestedProductIds) {
      const cached = this.forecastCache.get(productId);

      if (cached && cached.expiresAt > now) {
        cachedForecasts.set(productId, cached.forecast);
      } else {
        this.forecastCache.delete(productId);
        missingProductIds.push(productId);
      }
    }

    if (missingProductIds.length === 0) {
      return requestedProductIds.map(
        (productId) => cachedForecasts.get(productId)!,
      );
    }

    const chunks = this.chunkItems(missingProductIds, ML_FORECAST_BATCH_SIZE);
    const batches = await this.mapWithConcurrency(
      chunks,
      ML_BATCH_REQUEST_CONCURRENCY,
      (chunk) => this.fetchMlForecastBatch(chunk),
    );
    const fetchedForecasts = batches.flatMap((batch) => batch.forecasts);
    this.ensureExpectedForecasts(missingProductIds, fetchedForecasts);
    const expiresAt = now + this.getForecastCacheTtlMs();

    for (const forecast of fetchedForecasts) {
      this.forecastCache.set(forecast.productId, { forecast, expiresAt });
      cachedForecasts.set(forecast.productId, forecast);
    }

    return requestedProductIds.map(
      (productId) => cachedForecasts.get(productId)!,
    );
  }

  private ensureExpectedForecasts(
    productIds: number[],
    forecasts: MlStockoutForecast[],
  ): void {
    const responseProductIds = new Set(
      forecasts.map((forecast) => forecast.productId),
    );

    if (
      forecasts.length !== productIds.length ||
      responseProductIds.size !== productIds.length ||
      productIds.some((productId) => !responseProductIds.has(productId))
    ) {
      throw new BadGatewayException(
        'Le service de prévision a retourné une liste de produits incohérente.',
      );
    }
  }

  private async fetchMlForecastBatch(
    productIds: number[],
  ): Promise<MlStockoutForecastBatchResponse> {
    const mlServiceUrl = this.getMlServiceUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch(`${mlServiceUrl}/api/v1/stockout/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, days: 7 }),
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Le service de prévision est indisponible.',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'Le service de prévision n’a pas pu traiter la demande.',
      );
    }

    const body: unknown = await response.json();

    if (!this.isMlStockoutForecastBatchResponse(body)) {
      throw new BadGatewayException(
        'La réponse du service de prévision est invalide.',
      );
    }

    return body;
  }

  private getMlServiceUrl(): string {
    return (
      this.configService?.get<string>('ML_SERVICE_URL') ??
      'http://localhost:8000'
    ).replace(/\/$/, '');
  }

  private getForecastCacheTtlMs(): number {
    const configuredValue = Number(
      this.configService?.get<string>('ML_FORECAST_CACHE_TTL_MS'),
    );

    return Number.isSafeInteger(configuredValue) && configuredValue >= 0
      ? configuredValue
      : DEFAULT_ML_FORECAST_CACHE_TTL_MS;
  }

  private chunkItems<TItem>(items: TItem[], chunkSize: number): TItem[][] {
    const chunks: TItem[][] = [];

    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }

    return chunks;
  }

  private getForecastProductSelect(): Prisma.ProductSelect {
    return {
      id: true,
      name: true,
      reference: true,
      productTypeId: true,
      productType: { select: { type: true } },
    };
  }

  /*
  private ensureExpectedForecasts(
    productIds: number[],
    forecasts: MlStockoutForecast[],
  ): void {
    const responseProductIds = new Set(
      forecasts.map((forecast) => forecast.productId),
    );

    if (
      forecasts.length !== productIds.length ||
      responseProductIds.size !== productIds.length ||
      productIds.some((productId) => !responseProductIds.has(productId))
    ) {
      throw new BadGatewayException(
        'Le service de prévision a retourné une liste de produits incohérente.',
      );
    }
  }

  */
  private async mapWithConcurrency<TItem, TResult>(
    items: readonly TItem[],
    concurrency: number,
    mapper: (item: TItem) => Promise<TResult>,
  ): Promise<TResult[]> {
    const results = new Array<TResult>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index]);
      }
    });

    await Promise.all(workers);
    return results;
  }

  private toForecastItem(
    product: ForecastProduct,
    forecast: MlStockoutForecast,
  ): ForecastItem {
    return {
      productId: product.id,
      productName: product.name,
      productReference: product.reference,
      productTypeId: product.productTypeId,
      productType: product.productType.type,
      asOfDate: forecast.asOfDate,
      forecastDays: forecast.forecastDays,
      currentStock: forecast.currentStock,
      totalPredictedDemand: forecast.totalPredictedDemand,
      remainingStockAfterHorizon: forecast.remainingStockAfterHorizon,
      status: this.getForecastStatus(forecast),
      predictedStockoutDate: forecast.predictedStockoutDate,
      daysUntilStockout: forecast.daysUntilStockout,
    };
  }

  private getForecastStatus(forecast: MlStockoutForecast): ForecastStatus {
    if (forecast.alreadyOutOfStock) {
      return 'OUT_OF_STOCK';
    }

    return forecast.stockoutExpected ? 'STOCKOUT_EXPECTED' : 'SUFFICIENT_STOCK';
  }

  private isMlStockoutForecastBatchResponse(
    value: unknown,
  ): value is MlStockoutForecastBatchResponse {
    if (!this.isRecord(value) || !Array.isArray(value.forecasts)) {
      return false;
    }

    return value.forecasts.every((forecast) =>
      this.isMlStockoutForecast(forecast),
    );
  }

  private isMlStockoutForecast(value: unknown): value is MlStockoutForecast {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      typeof value.productId === 'number' &&
      typeof value.asOfDate === 'string' &&
      typeof value.forecastDays === 'number' &&
      typeof value.currentStock === 'number' &&
      typeof value.totalPredictedDemand === 'number' &&
      typeof value.alreadyOutOfStock === 'boolean' &&
      typeof value.stockoutExpected === 'boolean' &&
      (typeof value.predictedStockoutDate === 'string' ||
        value.predictedStockoutDate === null) &&
      (typeof value.daysUntilStockout === 'number' ||
        value.daysUntilStockout === null) &&
      typeof value.remainingStockAfterHorizon === 'number'
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private getNetPaidQuantity(detail: {
    quantity: number;
    refundedQuantity: number;
  }): number {
    return Math.max(
      detail.quantity - Math.min(detail.refundedQuantity, detail.quantity),
      0,
    );
  }
}
