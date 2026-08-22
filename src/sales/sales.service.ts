import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CartStatus,
  InventoryMovementType,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { CartEntity } from '../carts/entities/cart.entity';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { buildDateRangeFilter } from '../common/utils/date-range.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, CreateSaleItemDto } from './dto/create-sale.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { ListSaleCatalogQueryDto } from './dto/list-sale-catalog-query.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { SaleCatalogProductEntity } from './entities/sale-catalog-product.entity';
import { PaginatedSaleCatalog } from './interfaces/paginated-sale-catalog.interface';
import { PaginatedSales } from './interfaces/paginated-sales.interface';
import {
  AppliedSalePricing,
  calculateFreeQuantityPromotionAllocation,
  calculateSalePricing,
} from './utils/promotion-calculator.util';
import { selectLatestInventory } from './utils/latest-inventory.util';
import { getRestrictedSellerId } from './utils/sale-access.util';
import { generateInvoicePdf, type InvoiceData } from './utils/invoice-pdf.util';
import { recordSaleStockOutput } from './utils/sale-stock-output.util';
import { buildInsufficientStockMessage } from './utils/stock-message.util';
import {
  isManualWholesaleRequest,
  usesWholesalePrice,
} from './utils/wholesale-pricing.util';

const SALE_USER_SELECT = {
  id: true,
  userName: true,
  email: true,
} satisfies Prisma.UserSelect;

const SALE_INCLUDE = {
  seller: {
    select: SALE_USER_SELECT,
  },
  validator: {
    select: SALE_USER_SELECT,
  },
  cartDetails: {
    include: {
      inventory: {
        include: {
          product: true,
        },
      },
    },
  },
  inventoryMovements: {
    include: {
      actor: {
        select: SALE_USER_SELECT,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.CartInclude;

const SALE_INVENTORY_INCLUDE = {
  inventorySpecialOffers: {
    include: {
      specialOffer: true,
    },
  },
} satisfies Prisma.InventoryInclude;

const SALE_CATALOG_PRODUCT_INCLUDE = {
  inventories: {
    include: SALE_INVENTORY_INCLUDE,
  },
} satisfies Prisma.ProductInclude;

const INVOICE_STATUSES: readonly CartStatus[] = [
  CartStatus.VALIDATED,
  CartStatus.PAID,
  CartStatus.REFUNDED,
  CartStatus.CANCELLED,
];

type SalePayload = Prisma.CartGetPayload<{
  include: typeof SALE_INCLUDE;
}>;

type SaleInventoryPayload = Prisma.InventoryGetPayload<{
  include: typeof SALE_INVENTORY_INCLUDE;
}>;

type SaleCatalogProductPayload = Prisma.ProductGetPayload<{
  include: typeof SALE_CATALOG_PRODUCT_INCLUDE;
}>;

type SaleSpecialOfferPayload =
  SaleInventoryPayload['inventorySpecialOffers'][number]['specialOffer'];

interface PreparedSaleItem {
  productId: number;
  quantity: number;
  wholesale: boolean;
  inventory: SaleInventoryPayload;
  pricing: AppliedSalePricing;
  currentPrices: CurrentProductPrices;
}

interface CurrentProductPrices {
  retailPrice: Prisma.Decimal;
  wholesalePrice: Prisma.Decimal;
}

interface ActiveProductPromotion {
  offer: SaleSpecialOfferPayload;
  inventoryIds: ReadonlySet<number>;
  stockQuantity: number;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    dto: CreateSaleDto,
    user: AuthenticatedUser,
  ): Promise<CartEntity> {
    this.ensureUniqueProducts(dto.items);

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const productIds = dto.items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      const productNames = new Map(
        products.map((product) => [product.id, product.name]),
      );
      const inventories = await tx.inventory.findMany({
        where: {
          productId: { in: productIds },
        },
        include: SALE_INVENTORY_INCLUDE,
      });
      const preparedItems = this.prepareSaleItems(
        dto.items,
        inventories,
        productNames,
        now,
      );
      const totalPrice = preparedItems.reduce(
        (total, item) => total.plus(item.pricing.totalPrice),
        new Prisma.Decimal(0),
      );
      const requiresValidation =
        user.role !== 'ADMIN' &&
        dto.items.some((item) =>
          isManualWholesaleRequest(item.quantity, item.wholesale),
        );
      const status = requiresValidation
        ? CartStatus.PENDING
        : CartStatus.VALIDATED;

      const cart = await tx.cart.create({
        data: {
          soldBy: user.id,
          status,
          validatedBy: requiresValidation ? null : user.id,
          totalPrice: totalPrice.toFixed(2),
          customerName: dto.customerName?.trim() || null,
          customerContact: dto.customerContact?.trim() || null,
          customerAddress: dto.customerAddress?.trim() || null,
          customerNif: dto.customerNif?.trim() || null,
          customerStat: dto.customerStat?.trim() || null,
          paymentMethod: dto.paymentMethod,
          cartDetails: {
            create: preparedItems.map((item) => ({
              inventoryId: item.inventory.id,
              quantity: item.quantity,
              freeQuantity: item.pricing.freeQuantity,
              baseUnitPrice: item.pricing.baseUnitPrice.toFixed(2),
              finalUnitPrice: item.pricing.finalUnitPrice.toFixed(2),
              discountAmount: item.pricing.discountAmount?.toFixed(2) ?? null,
              wholesale: item.wholesale,
              specialOfferId: item.pricing.specialOfferId,
            })),
          },
        },
        select: { id: true },
      });

      for (const item of preparedItems) {
        await this.recordStockOutput(tx, item, cart.id, user.id);
      }

      return this.findSaleInTransaction(cart.id, tx);
    });
  }

  async findCatalog(
    query: ListSaleCatalogQueryDto,
  ): Promise<PaginatedSaleCatalog> {
    const trimmedSearch = query.search?.trim();
    const now = new Date();
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: trimmedSearch
          ? [
              { name: { contains: trimmedSearch, mode: 'insensitive' } },
              { reference: { contains: trimmedSearch, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: SALE_CATALOG_PRODUCT_INCLUDE,
    });
    const catalog = products
      .map((product) => this.mapCatalogProduct(product, now))
      .sort(
        (firstProduct, secondProduct) =>
          Number(secondProduct.hasPromotion) -
            Number(firstProduct.hasPromotion) ||
          firstProduct.name.localeCompare(secondProduct.name),
      );
    const total = catalog.length;
    const skip = (query.page - 1) * query.limit;

    return {
      data: catalog.slice(skip, skip + query.limit),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findAll(
    query: ListSalesQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedSales> {
    const where = this.buildListWhere(query, user);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cart.findMany({
        where,
        include: SALE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.cart.count({ where }),
    ]);

    return {
      data: data.map((sale) => this.mapSale(sale)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: number, user: AuthenticatedUser): Promise<CartEntity> {
    const sale = await this.prisma.cart.findFirst({
      where: this.buildAccessibleSaleWhere(id, user),
      include: SALE_INCLUDE,
    });

    if (!sale) {
      throw new NotFoundException('Vente introuvable.');
    }

    return this.mapSale(sale);
  }

  async pay(
    id: number,
    paymentMethod: PaymentMethod,
    user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cart.updateMany({
        where: {
          id,
          status: CartStatus.VALIDATED,
          soldBy: getRestrictedSellerId(user),
        },
        data: {
          status: CartStatus.PAID,
          paymentMethod,
        },
      });

      if (updated.count === 0) {
        await this.throwInvalidSaleTransition(
          id,
          [CartStatus.VALIDATED],
          user,
          tx,
        );
      }

      return this.findSaleInTransaction(id, tx);
    });
  }

  async validate(id: number, admin: AuthenticatedUser): Promise<CartEntity> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cart.updateMany({
        where: { id, status: CartStatus.PENDING },
        data: {
          status: CartStatus.VALIDATED,
          validatedBy: admin.id,
        },
      });

      if (updated.count === 0) {
        await this.throwInvalidSaleTransition(
          id,
          [CartStatus.PENDING],
          admin,
          tx,
        );
      }

      return this.findSaleInTransaction(id, tx);
    });
  }

  async generateInvoice(
    id: number,
    dto: GenerateInvoiceDto,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const sale = await this.prisma.cart.findFirst({
      where: this.buildAccessibleSaleWhere(id, user),
      include: SALE_INCLUDE,
    });

    if (!sale) {
      throw new NotFoundException('Vente introuvable.');
    }

    if (!INVOICE_STATUSES.includes(sale.status)) {
      throw new BadRequestException(
        'Une facture ne peut pas être générée pour cette vente.',
      );
    }

    const customerName = dto.customerName?.trim() || sale.customerName?.trim();

    if (!customerName) {
      throw new BadRequestException(
        'Le nom du client est obligatoire pour générer une facture.',
      );
    }

    const customerContact =
      dto.customerContact === undefined
        ? sale.customerContact
        : dto.customerContact.trim() || null;
    const customerAddress =
      dto.customerAddress === undefined
        ? sale.customerAddress
        : dto.customerAddress.trim() || null;
    const customerNif =
      dto.customerNif === undefined
        ? sale.customerNif
        : dto.customerNif.trim() || null;
    const customerStat =
      dto.customerStat === undefined
        ? sale.customerStat
        : dto.customerStat.trim() || null;

    if (
      customerName !== sale.customerName ||
      customerContact !== sale.customerContact ||
      customerAddress !== sale.customerAddress ||
      customerNif !== sale.customerNif ||
      customerStat !== sale.customerStat
    ) {
      await this.prisma.cart.update({
        where: { id },
        data: {
          customerName,
          customerContact,
          customerAddress,
          customerNif,
          customerStat,
        },
      });
    }

    const invoice: InvoiceData = {
      saleId: sale.id,
      createdAt: sale.createdAt,
      customerName,
      customerContact,
      customerAddress,
      customerNif,
      customerStat,
      company: {
        address: this.configService.get<string>(
          'MADIS_ADDRESS',
          'AVARATRANTANIMORA',
        ),
        nif: this.configService.get<string>('MADIS_NIF', '4019 20 33 95'),
        stat: this.configService.get<string>(
          'MADIS_STAT',
          '46900 11 2025 0 03 535',
        ),
        slogan: this.configService.get<string>(
          'MADIS_SLOGAN',
          'SMART CHOICE, BETTER LIFE',
        ),
        logoPath: this.configService.get<string>(
          'MADIS_LOGO_PATH',
          'assets/logo.png',
        ),
      },
      sellerName: sale.seller.userName,
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      reason: sale.reason,
      totalPrice: sale.totalPrice.toFixed(2),
      lines: sale.cartDetails.map((detail) => ({
        productName: detail.inventory.product.name,
        quantity: detail.quantity,
        freeQuantity: detail.freeQuantity ?? 0,
        unitPrice: detail.finalUnitPrice.toFixed(2),
        totalPrice: detail.finalUnitPrice.mul(detail.quantity).toFixed(2),
      })),
    };

    return generateInvoicePdf(invoice);
  }

  async refund(
    id: number,
    reason: string,
    user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.reverseSale(
      id,
      reason,
      user,
      [CartStatus.PAID],
      CartStatus.REFUNDED,
      InventoryMovementType.REFUND,
    );
  }

  async cancel(
    id: number,
    reason: string,
    user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.reverseSale(
      id,
      reason,
      user,
      [CartStatus.PENDING, CartStatus.VALIDATED],
      CartStatus.CANCELLED,
      InventoryMovementType.CANCELLATION,
    );
  }

  private async reverseSale(
    id: number,
    reason: string,
    user: AuthenticatedUser,
    expectedStatuses: readonly CartStatus[],
    targetStatus: CartStatus,
    movementType: InventoryMovementType,
  ): Promise<CartEntity> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: this.buildAccessibleSaleWhere(id, user),
        include: {
          cartDetails: {
            include: { inventory: true },
          },
        },
      });

      if (!cart) {
        throw new NotFoundException('Vente introuvable.');
      }

      const updated = await tx.cart.updateMany({
        where: {
          id,
          status: { in: [...expectedStatuses] },
          soldBy: getRestrictedSellerId(user),
        },
        data: {
          status: targetStatus,
          reason: reason.trim(),
        },
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          `Une vente au statut ${cart.status} ne peut pas effectuer cette action.`,
        );
      }

      for (const detail of cart.cartDetails) {
        const restoredQuantity = detail.quantity + (detail.freeQuantity ?? 0);

        await tx.inventory.update({
          where: { id: detail.inventoryId },
          data: {
            remainingQuantity: { increment: restoredQuantity },
          },
        });
        await tx.inventoryMovement.create({
          data: {
            inventoryId: detail.inventoryId,
            incomingQuantity: restoredQuantity,
            outgoingQuantity: 0,
            actorId: user.id,
            type: movementType,
            purchasePrice: detail.inventory.purchasePrice,
            salePrice: detail.inventory.salePrice,
            wholesalePrice: detail.inventory.wholesalePrice,
            cartId: id,
          },
        });
      }

      return this.findSaleInTransaction(id, tx);
    });
  }

  private prepareSaleItems(
    items: readonly CreateSaleItemDto[],
    inventories: readonly SaleInventoryPayload[],
    productNames: ReadonlyMap<number, string>,
    now: Date,
  ): PreparedSaleItem[] {
    const inventoryByProduct = new Map<number, SaleInventoryPayload[]>();

    inventories.forEach((inventory) => {
      const productInventories =
        inventoryByProduct.get(inventory.productId) ?? [];
      productInventories.push(inventory);
      inventoryByProduct.set(inventory.productId, productInventories);
    });

    return items.flatMap((item) =>
      this.prepareProductSaleItem(
        item,
        inventoryByProduct.get(item.productId) ?? [],
        productNames.get(item.productId) ?? `n°${item.productId}`,
        now,
      ),
    );
  }

  private prepareProductSaleItem(
    item: CreateSaleItemDto,
    inventories: readonly SaleInventoryPayload[],
    productName: string,
    now: Date,
  ): PreparedSaleItem[] {
    const sellableInventories = this.getSellableInventories(inventories, now);
    const promotion = this.findActiveProductPromotion(sellableInventories, now);
    const orderedInventories = this.sortInventoriesForSale(
      sellableInventories,
      promotion?.inventoryIds,
    );
    const remainingStocks = new Map(
      orderedInventories.map((inventory) => [
        inventory.id,
        inventory.remainingQuantity,
      ]),
    );
    const wholesale = usesWholesalePrice(item.quantity, item.wholesale);
    const latestInventory = selectLatestInventory(inventories);

    if (!latestInventory) {
      throw new ConflictException(
        `Aucun lot n'est disponible pour le produit « ${productName} ».`,
      );
    }

    const currentPrices: CurrentProductPrices = {
      retailPrice: latestInventory.salePrice,
      wholesalePrice: latestInventory.wholesalePrice,
    };
    const baseUnitPrice = wholesale
      ? currentPrices.wholesalePrice
      : currentPrices.retailPrice;
    const allocations: PreparedSaleItem[] = [];
    let promotionPaidQuantity = 0;

    if (promotion?.offer.type === 'REDUCTION') {
      promotionPaidQuantity = Math.min(item.quantity, promotion.stockQuantity);
      this.allocateReduction(
        item.productId,
        promotionPaidQuantity,
        wholesale,
        baseUnitPrice,
        currentPrices,
        orderedInventories,
        remainingStocks,
        promotion,
        allocations,
      );
    } else if (promotion) {
      const buyQuantity = promotion.offer.buyQuantity ?? 0;
      const freeQuantity = promotion.offer.freeQuantity ?? 0;
      const promotionAllocation = calculateFreeQuantityPromotionAllocation(
        item.quantity,
        promotion.stockQuantity,
        buyQuantity,
        freeQuantity,
      );
      promotionPaidQuantity = promotionAllocation.paidQuantity;
      this.allocateFreeQuantityPromotion(
        item.productId,
        promotionPaidQuantity,
        promotionAllocation.freeQuantity,
        wholesale,
        baseUnitPrice,
        currentPrices,
        orderedInventories,
        remainingStocks,
        promotion,
        allocations,
      );
    }

    this.allocateWithoutPromotion(
      item.productId,
      item.quantity - promotionPaidQuantity,
      wholesale,
      baseUnitPrice,
      currentPrices,
      orderedInventories,
      remainingStocks,
      allocations,
    );

    const allocatedPaidQuantity = allocations.reduce(
      (total, allocation) => total + allocation.quantity,
      0,
    );

    if (allocatedPaidQuantity !== item.quantity) {
      const availableQuantity = sellableInventories.reduce(
        (total, inventory) => total + inventory.remainingQuantity,
        0,
      );

      throw new ConflictException(
        buildInsufficientStockMessage(
          productName,
          item.quantity,
          availableQuantity,
        ),
      );
    }

    return allocations;
  }

  private allocateReduction(
    productId: number,
    requestedQuantity: number,
    wholesale: boolean,
    baseUnitPrice: Prisma.Decimal,
    currentPrices: CurrentProductPrices,
    inventories: readonly SaleInventoryPayload[],
    remainingStocks: Map<number, number>,
    promotion: ActiveProductPromotion,
    allocations: PreparedSaleItem[],
  ): void {
    let remainingQuantity = requestedQuantity;

    for (const inventory of inventories) {
      if (remainingQuantity === 0) {
        return;
      }

      if (!promotion.inventoryIds.has(inventory.id)) {
        continue;
      }

      const availableQuantity = remainingStocks.get(inventory.id) ?? 0;
      const quantity = Math.min(remainingQuantity, availableQuantity);

      if (quantity === 0) {
        continue;
      }

      allocations.push({
        productId,
        quantity,
        wholesale,
        inventory,
        currentPrices,
        pricing: calculateSalePricing(baseUnitPrice, quantity, [
          promotion.offer,
        ]),
      });
      remainingStocks.set(inventory.id, availableQuantity - quantity);
      remainingQuantity -= quantity;
    }
  }

  private allocateFreeQuantityPromotion(
    productId: number,
    paidQuantity: number,
    freeQuantity: number,
    wholesale: boolean,
    baseUnitPrice: Prisma.Decimal,
    currentPrices: CurrentProductPrices,
    inventories: readonly SaleInventoryPayload[],
    remainingStocks: Map<number, number>,
    promotion: ActiveProductPromotion,
    allocations: PreparedSaleItem[],
  ): void {
    let remainingPaidQuantity = paidQuantity;
    let remainingFreeQuantity = freeQuantity;

    for (const inventory of inventories) {
      if (
        (remainingPaidQuantity === 0 && remainingFreeQuantity === 0) ||
        !promotion.inventoryIds.has(inventory.id)
      ) {
        continue;
      }

      const availableQuantity = remainingStocks.get(inventory.id) ?? 0;
      const allocatedPaidQuantity = Math.min(
        remainingPaidQuantity,
        availableQuantity,
      );
      const allocatedFreeQuantity = Math.min(
        remainingFreeQuantity,
        availableQuantity - allocatedPaidQuantity,
      );
      const stockQuantity = allocatedPaidQuantity + allocatedFreeQuantity;

      if (stockQuantity === 0) {
        continue;
      }

      allocations.push({
        productId,
        quantity: allocatedPaidQuantity,
        wholesale,
        inventory,
        currentPrices,
        pricing: {
          specialOfferId: promotion.offer.id,
          freeQuantity: allocatedFreeQuantity || null,
          baseUnitPrice,
          finalUnitPrice: baseUnitPrice,
          discountAmount: null,
          totalPrice: baseUnitPrice
            .mul(allocatedPaidQuantity)
            .toDecimalPlaces(2),
          stockQuantity,
        },
      });
      remainingStocks.set(inventory.id, availableQuantity - stockQuantity);
      remainingPaidQuantity -= allocatedPaidQuantity;
      remainingFreeQuantity -= allocatedFreeQuantity;
    }
  }

  private allocateWithoutPromotion(
    productId: number,
    requestedQuantity: number,
    wholesale: boolean,
    baseUnitPrice: Prisma.Decimal,
    currentPrices: CurrentProductPrices,
    inventories: readonly SaleInventoryPayload[],
    remainingStocks: Map<number, number>,
    allocations: PreparedSaleItem[],
  ): void {
    let remainingQuantity = requestedQuantity;

    for (const inventory of inventories) {
      if (remainingQuantity === 0) {
        return;
      }

      const availableQuantity = remainingStocks.get(inventory.id) ?? 0;
      const quantity = Math.min(remainingQuantity, availableQuantity);

      if (quantity === 0) {
        continue;
      }

      allocations.push({
        productId,
        quantity,
        wholesale,
        inventory,
        currentPrices,
        pricing: calculateSalePricing(baseUnitPrice, quantity, []),
      });
      remainingStocks.set(inventory.id, availableQuantity - quantity);
      remainingQuantity -= quantity;
    }
  }

  private findActiveProductPromotion(
    inventories: readonly SaleInventoryPayload[],
    now: Date,
  ): ActiveProductPromotion | null {
    const promotions = new Map<number, ActiveProductPromotion>();

    inventories.forEach((inventory) => {
      inventory.inventorySpecialOffers.forEach((association) => {
        if (!this.isOfferActive(association, now)) {
          return;
        }

        const currentPromotion = promotions.get(association.specialOffer.id);
        const inventoryIds = new Set(currentPromotion?.inventoryIds ?? []);
        inventoryIds.add(inventory.id);
        promotions.set(association.specialOffer.id, {
          offer: association.specialOffer,
          inventoryIds,
          stockQuantity:
            (currentPromotion?.stockQuantity ?? 0) +
            inventory.remainingQuantity,
        });
      });
    });

    return (
      [...promotions.values()]
        .filter(({ offer, stockQuantity }) =>
          this.hasSufficientPromotionStock(offer, stockQuantity),
        )
        .sort(
          (firstPromotion, secondPromotion) =>
            firstPromotion.offer.endDateTime.getTime() -
              secondPromotion.offer.endDateTime.getTime() ||
            firstPromotion.offer.id - secondPromotion.offer.id,
        )[0] ?? null
    );
  }

  private hasSufficientPromotionStock(
    offer: SaleSpecialOfferPayload,
    stockQuantity: number,
  ): boolean {
    if (offer.type === 'REDUCTION') {
      return stockQuantity > 0;
    }

    const buyQuantity = offer.buyQuantity ?? 0;
    const freeQuantity = offer.freeQuantity ?? 0;

    return (
      calculateFreeQuantityPromotionAllocation(
        buyQuantity,
        stockQuantity,
        buyQuantity,
        freeQuantity,
      ).paidQuantity > 0
    );
  }

  private getSellableInventories(
    inventories: readonly SaleInventoryPayload[],
    now: Date,
  ): SaleInventoryPayload[] {
    return inventories.filter(
      (inventory) =>
        inventory.remainingQuantity > 0 &&
        (inventory.expiredAt === null || inventory.expiredAt >= now),
    );
  }

  private sortInventoriesForSale(
    inventories: readonly SaleInventoryPayload[],
    promotionalInventoryIds?: ReadonlySet<number>,
  ): SaleInventoryPayload[] {
    return [...inventories].sort((firstInventory, secondInventory) => {
      const promotionPriority =
        Number(promotionalInventoryIds?.has(secondInventory.id) ?? false) -
        Number(promotionalInventoryIds?.has(firstInventory.id) ?? false);

      return (
        promotionPriority ||
        firstInventory.createdAt.getTime() -
          secondInventory.createdAt.getTime() ||
        firstInventory.id - secondInventory.id
      );
    });
  }

  private isOfferActive(
    association: SaleInventoryPayload['inventorySpecialOffers'][number],
    now: Date,
  ): boolean {
    const { specialOffer } = association;

    return (
      specialOffer.deletedAt === null &&
      specialOffer.startDateTime <= now &&
      specialOffer.endDateTime >= now
    );
  }

  private mapCatalogProduct(
    product: SaleCatalogProductPayload,
    now: Date,
  ): SaleCatalogProductEntity {
    const sellableInventories = this.getSellableInventories(
      product.inventories,
      now,
    );
    const promotion = this.findActiveProductPromotion(sellableInventories, now);
    const latestInventory = selectLatestInventory(product.inventories);
    const retailPricing = latestInventory
      ? calculateSalePricing(
          latestInventory.salePrice,
          1,
          promotion ? [promotion.offer] : [],
        )
      : null;
    const wholesalePricing = latestInventory
      ? calculateSalePricing(
          latestInventory.wholesalePrice,
          1,
          promotion ? [promotion.offer] : [],
        )
      : null;

    return {
      id: product.id,
      name: product.name,
      reference: product.reference,
      image: product.image,
      retailPrice: retailPricing?.finalUnitPrice.toFixed(2) ?? null,
      wholesalePrice: wholesalePricing?.finalUnitPrice.toFixed(2) ?? null,
      baseRetailPrice: latestInventory?.salePrice.toFixed(2) ?? null,
      baseWholesalePrice: latestInventory?.wholesalePrice.toFixed(2) ?? null,
      totalStock: sellableInventories.reduce(
        (total, inventory) => total + inventory.remainingQuantity,
        0,
      ),
      promotionStock: promotion?.stockQuantity ?? 0,
      hasPromotion: promotion !== null,
      promotionEndDate: promotion?.offer.endDateTime ?? null,
      promotion: promotion
        ? {
            id: promotion.offer.id,
            type: promotion.offer.type,
            value: promotion.offer.value?.toFixed(2) ?? null,
            unit: promotion.offer.unit,
            buyQuantity: promotion.offer.buyQuantity,
            freeQuantity: promotion.offer.freeQuantity,
          }
        : null,
    };
  }

  private ensureUniqueProducts(items: readonly CreateSaleItemDto[]): void {
    const productIds = new Set(items.map((item) => item.productId));

    if (productIds.size !== items.length) {
      throw new ConflictException(
        "Un produit ne peut apparaître qu'une fois dans une vente.",
      );
    }
  }

  private async recordStockOutput(
    tx: Prisma.TransactionClient,
    item: PreparedSaleItem,
    cartId: number,
    userId: number,
  ): Promise<void> {
    await recordSaleStockOutput(tx, {
      inventoryId: item.inventory.id,
      quantity: item.pricing.stockQuantity,
      actorId: userId,
      cartId,
      purchasePrice: item.inventory.purchasePrice,
      salePrice: item.currentPrices.retailPrice,
      wholesalePrice: item.currentPrices.wholesalePrice,
    });
  }

  private async throwInvalidSaleTransition(
    id: number,
    expectedStatuses: readonly CartStatus[],
    user: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<never> {
    const cart = await tx.cart.findFirst({
      where: this.buildAccessibleSaleWhere(id, user),
      select: { status: true },
    });

    if (!cart) {
      throw new NotFoundException('Vente introuvable.');
    }

    throw new BadRequestException(
      `La vente doit avoir l'un des statuts ${expectedStatuses.join(', ')} pour effectuer cette action.`,
    );
  }

  private async findSaleInTransaction(
    id: number,
    tx: Prisma.TransactionClient,
  ): Promise<CartEntity> {
    const sale = await tx.cart.findUnique({
      where: { id },
      include: SALE_INCLUDE,
    });

    if (!sale) {
      throw new NotFoundException('Vente introuvable.');
    }

    return this.mapSale(sale);
  }

  private buildListWhere(
    query: ListSalesQueryDto,
    user: AuthenticatedUser,
  ): Prisma.CartWhereInput {
    const trimmedSearch = query.search?.trim();

    return {
      soldBy: getRestrictedSellerId(user),
      createdAt: buildDateRangeFilter(query),
      status: query.approvalQueue
        ? { in: [CartStatus.PENDING, CartStatus.VALIDATED] }
        : query.status,
      paymentMethod: query.paymentMethod,
      cartDetails: query.approvalQueue
        ? {
            some: {
              wholesale: true,
            },
          }
        : undefined,
      OR: trimmedSearch
        ? [
            {
              customerName: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
            {
              customerContact: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
            {
              seller: {
                userName: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
            },
          ]
        : undefined,
    };
  }

  private buildAccessibleSaleWhere(
    id: number,
    user: AuthenticatedUser,
  ): Prisma.CartWhereInput {
    return {
      id,
      soldBy: getRestrictedSellerId(user),
    };
  }

  private mapSale(sale: SalePayload): CartEntity {
    return {
      id: sale.id,
      soldBy: sale.soldBy,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      status: sale.status,
      validatedBy: sale.validatedBy,
      totalPrice: sale.totalPrice.toFixed(2),
      customerName: sale.customerName,
      customerContact: sale.customerContact,
      customerAddress: sale.customerAddress,
      customerNif: sale.customerNif,
      customerStat: sale.customerStat,
      paymentMethod: sale.paymentMethod,
      reason: sale.reason,
      seller: sale.seller,
      validator: sale.validator,
      cartDetails: sale.cartDetails.map((detail) => ({
        id: detail.id,
        cartId: detail.cartId,
        inventoryId: detail.inventoryId,
        quantity: detail.quantity,
        freeQuantity: detail.freeQuantity,
        baseUnitPrice: detail.baseUnitPrice.toFixed(2),
        finalUnitPrice: detail.finalUnitPrice.toFixed(2),
        discountAmount: detail.discountAmount?.toFixed(2) ?? null,
        wholesale: detail.wholesale,
        specialOfferId: detail.specialOfferId,
        product: {
          id: detail.inventory.product.id,
          name: detail.inventory.product.name,
          reference: detail.inventory.product.reference,
          image: detail.inventory.product.image,
        },
      })),
      inventoryMovements: sale.inventoryMovements.map((movement) => ({
        id: movement.id,
        inventoryId: movement.inventoryId,
        incomingQuantity: movement.incomingQuantity,
        outgoingQuantity: movement.outgoingQuantity,
        actorId: movement.actorId,
        createdAt: movement.createdAt,
        updatedAt: movement.updatedAt,
        purchasePrice: movement.purchasePrice.toFixed(2),
        salePrice: movement.salePrice.toFixed(2),
        type: movement.type,
        wholesalePrice: movement.wholesalePrice.toFixed(2),
        cartId: movement.cartId,
        actor: movement.actor,
      })),
    };
  }
}
