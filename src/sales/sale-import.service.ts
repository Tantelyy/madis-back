import { BadRequestException, Injectable } from '@nestjs/common';
import { CartStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeNameKey } from '../products/utils/product-name.util';
import type {
  SaleImportSummary,
  UploadedSaleCsvFile,
} from './interfaces/sale-import.interface';
import {
  parseSaleCsv,
  SaleCsvValidationError,
  type SaleCsvRow,
} from './utils/sale-csv.util';
import { recordSaleStockOutput } from './utils/sale-stock-output.util';

const IMPORT_INVENTORY_SELECT = {
  id: true,
  createdAt: true,
  remainingQuantity: true,
  purchasePrice: true,
  salePrice: true,
  wholesalePrice: true,
  product: { select: { reference: true } },
  supplier: { select: { name: true } },
} satisfies Prisma.InventorySelect;

type ImportInventory = Prisma.InventoryGetPayload<{
  select: typeof IMPORT_INVENTORY_SELECT;
}>;

@Injectable()
export class SaleImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importCsv(
    file: UploadedSaleCsvFile | undefined,
    userId: number,
  ): Promise<SaleImportSummary> {
    this.validateFile(file);

    let parsed: ReturnType<typeof parseSaleCsv>;

    try {
      parsed = parseSaleCsv(file.buffer);
    } catch (error) {
      if (error instanceof SaleCsvValidationError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }

    const summary: SaleImportSummary = {
      rowsProcessed: parsed.rowsProcessed,
      rowsNotSold: parsed.rowsNotSold,
      rowsWithoutInventory: 0,
      salesCreated: 0,
      movementsCreated: 0,
    };

    if (parsed.rows.length === 0) {
      return summary;
    }

    return this.prisma.$transaction(
      async (tx) => this.persistSales(parsed.rows, summary, userId, tx),
      { maxWait: 10_000, timeout: 120_000 },
    );
  }

  private validateFile(
    file: UploadedSaleCsvFile | undefined,
  ): asserts file is UploadedSaleCsvFile {
    if (!file) {
      throw new BadRequestException('Veuillez sélectionner un fichier CSV.');
    }

    if (!file.originalname.toLocaleLowerCase('fr').endsWith('.csv')) {
      throw new BadRequestException('Seuls les fichiers CSV sont acceptés.');
    }
  }

  private async persistSales(
    rows: readonly SaleCsvRow[],
    summary: SaleImportSummary,
    userId: number,
    tx: Prisma.TransactionClient,
  ): Promise<SaleImportSummary> {
    const inventories = await this.findMatchingInventories(rows, tx);
    const inventoriesByKey = new Map<string, ImportInventory[]>();
    const availableQuantityById = new Map<number, number>();

    for (const inventory of inventories) {
      const key = buildInventoryMatchKey(
        inventory.createdAt,
        inventory.product.reference,
        inventory.supplier.name,
      );
      const candidates = inventoriesByKey.get(key) ?? [];

      candidates.push(inventory);
      inventoriesByKey.set(key, candidates);
      availableQuantityById.set(inventory.id, inventory.remainingQuantity);
    }

    for (const row of rows) {
      const key = buildInventoryMatchKey(
        row.inventoryCreatedAt,
        row.reference,
        row.supplier,
      );
      const inventory = inventoriesByKey
        .get(key)
        ?.find(
          (candidate) => (availableQuantityById.get(candidate.id) ?? 0) >= 1,
        );

      if (!inventory) {
        summary.rowsWithoutInventory += 1;
        continue;
      }

      const unitPrice = row.unitPrice.toFixed(2);
      const cart = await tx.cart.create({
        data: {
          soldBy: userId,
          validatedBy: userId,
          validatedAt: row.saleCreatedAt,
          paidAt: row.saleCreatedAt,
          createdAt: row.saleCreatedAt,
          status: CartStatus.PAID,
          paymentMethod: PaymentMethod.CASH,
          totalPrice: unitPrice,
          cartDetails: {
            create: {
              inventoryId: inventory.id,
              quantity: 1,
              freeQuantity: null,
              baseUnitPrice: unitPrice,
              finalUnitPrice: unitPrice,
              discountAmount: null,
              wholesale: row.wholesale,
              specialOfferId: null,
            },
          },
        },
        select: { id: true },
      });

      await recordSaleStockOutput(tx, {
        inventoryId: inventory.id,
        quantity: 1,
        actorId: userId,
        cartId: cart.id,
        purchasePrice: inventory.purchasePrice,
        salePrice: inventory.salePrice,
        wholesalePrice: inventory.wholesalePrice,
        createdAt: row.saleCreatedAt,
      });

      availableQuantityById.set(
        inventory.id,
        (availableQuantityById.get(inventory.id) ?? 1) - 1,
      );
      summary.salesCreated += 1;
      summary.movementsCreated += 1;
    }

    return summary;
  }

  private findMatchingInventories(
    rows: readonly SaleCsvRow[],
    tx: Prisma.TransactionClient,
  ): Promise<ImportInventory[]> {
    const uniqueRows = new Map<string, SaleCsvRow>();

    for (const row of rows) {
      uniqueRows.set(
        buildInventoryMatchKey(
          row.inventoryCreatedAt,
          row.reference,
          row.supplier,
        ),
        row,
      );
    }

    const filters: Prisma.InventoryWhereInput[] = [...uniqueRows.values()].map(
      (row) => ({
        createdAt: row.inventoryCreatedAt,
        product: {
          reference: {
            equals: row.reference,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        supplier: {
          name: {
            equals: row.supplier,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      }),
    );

    return tx.inventory.findMany({
      where: {
        remainingQuantity: { gt: 0 },
        OR: filters,
      },
      select: IMPORT_INVENTORY_SELECT,
      orderBy: { id: 'asc' },
    });
  }
}

function buildInventoryMatchKey(
  createdAt: Date,
  reference: string,
  supplier: string,
): string {
  return [
    createdAt.getTime(),
    normalizeNameKey(reference),
    normalizeNameKey(supplier),
  ].join('|');
}
