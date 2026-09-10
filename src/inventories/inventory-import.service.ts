import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  composeProductName,
  extractProductType,
  normalizeNameKey,
} from '../products/utils/product-name.util';
import type {
  InventoryImportSummary,
  UploadedInventoryCsvFile,
} from './interfaces/inventory-import.interface';
import { InventoryPricingService } from './inventory-pricing.service';
import {
  InventoryCsvValidationError,
  parseInventoryCsv,
} from './utils/inventory-csv.util';
import {
  buildInventoryImportLots,
  selectImportableRows,
  type ImportableInventoryCsvRow,
  type ResolvedInventoryImportRow,
} from './utils/inventory-import-lot.util';
import {
  buildIncomingInventoryData,
  type InventoryPriceValues,
} from './utils/inventory-write.util';

interface MarkRecord {
  id: number;
  name: string;
}

interface SpecificationRecord {
  id: number;
  specification: string;
  deletedAt: Date | null;
}

interface FormatRecord {
  id: number;
  format: string;
}

interface ProductTypeRecord {
  id: number;
  type: string;
}

interface SupplierRecord {
  id: number;
  name: string;
  deletedAt: Date | null;
}

interface ProductRecord {
  id: number;
  name: string;
  reference: string;
  deletedAt: Date | null;
}

interface PreparedImportRow extends ImportableInventoryCsvRow {
  productName: string;
  markId: number;
  specificationId: number;
  formatId: number;
  productTypeId: number;
  supplierId: number;
}

type MutableImportSummary = InventoryImportSummary;

@Injectable()
export class InventoryImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryPricingService: InventoryPricingService,
  ) {}

  async importCsv(
    file: UploadedInventoryCsvFile | undefined,
    userId: number,
  ): Promise<InventoryImportSummary> {
    this.validateFile(file);

    let rows: ReturnType<typeof parseInventoryCsv>;
    let selection: ReturnType<typeof selectImportableRows>;

    try {
      rows = parseInventoryCsv(file.buffer);
      selection = selectImportableRows(rows);
    } catch (error) {
      if (error instanceof InventoryCsvValidationError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }

    const summary = createImportSummary(
      rows.length,
      selection.rowsSkipped,
      selection.lotsSkipped,
    );

    if (selection.rows.length === 0) {
      return summary;
    }

    return this.prisma.$transaction(
      async (tx) => this.persistRows(selection.rows, summary, userId, tx),
      { maxWait: 10_000, timeout: 120_000 },
    );
  }

  private validateFile(
    file: UploadedInventoryCsvFile | undefined,
  ): asserts file is UploadedInventoryCsvFile {
    if (!file) {
      throw new BadRequestException('Veuillez sélectionner un fichier CSV.');
    }

    if (!file.originalname.toLocaleLowerCase('fr').endsWith('.csv')) {
      throw new BadRequestException('Seuls les fichiers CSV sont acceptés.');
    }
  }

  private async persistRows(
    rows: readonly ImportableInventoryCsvRow[],
    summary: MutableImportSummary,
    userId: number,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryImportSummary> {
    const [marks, specifications, formats, productTypes, suppliers] =
      await Promise.all([
        tx.productMark.findMany({ orderBy: { id: 'asc' } }),
        tx.productSpecification.findMany({ orderBy: { id: 'asc' } }),
        tx.productFormat.findMany({ orderBy: { id: 'asc' } }),
        tx.productType.findMany({ orderBy: { id: 'asc' } }),
        tx.supplier.findMany({ orderBy: { id: 'asc' } }),
      ]);
    const markByName = createLookup<MarkRecord>(marks, (mark) => mark.name);
    const specificationByName = createLookup<SpecificationRecord>(
      specifications,
      (specification) => specification.specification,
    );
    const formatByName = createLookup<FormatRecord>(
      formats,
      (format) => format.format,
    );
    const typeByName = createLookup<ProductTypeRecord>(
      productTypes,
      (productType) => productType.type,
    );
    const supplierByName = createLookup<SupplierRecord>(
      suppliers,
      (supplier) => supplier.name,
    );
    const preparedRows: PreparedImportRow[] = [];

    for (const row of rows) {
      const mark = await this.resolveMark(row, markByName, summary, tx);
      const specification = await this.resolveSpecification(
        row,
        specificationByName,
        summary,
        tx,
      );
      const format = await this.resolveFormat(row, formatByName, summary, tx);
      const supplier = await this.resolveSupplier(
        row,
        supplierByName,
        summary,
        userId,
        tx,
      );
      const productType = await this.resolveProductType(
        row,
        typeByName,
        summary,
        tx,
      );
      const productName = composeProductName({
        type: productType.type,
        specification: specification.specification,
        mark: mark.name,
        format: format.format,
      });

      preparedRows.push({
        ...row,
        productName,
        markId: mark.id,
        specificationId: specification.id,
        formatId: format.id,
        productTypeId: productType.id,
        supplierId: supplier.id,
      });
    }

    const resolvedRows = await this.resolveProducts(
      preparedRows,
      summary,
      userId,
      tx,
    );
    const lots = buildInventoryImportLots(resolvedRows);
    const priceCache = new Map<string, InventoryPriceValues>();

    for (const lot of lots) {
      const priceKey = [
        lot.purchasePrice,
        lot.salePrice ?? 'margin',
        lot.wholesalePrice ?? 'margin',
      ].join('|');
      let prices = priceCache.get(priceKey);

      if (!prices) {
        prices = await this.inventoryPricingService.resolveImportedPrices(
          lot.purchasePrice,
          lot.salePrice,
          lot.wholesalePrice,
          tx,
        );
        priceCache.set(priceKey, prices);
      }

      await tx.inventory.create({
        data: buildIncomingInventoryData({
          productId: lot.productId,
          supplierId: lot.supplierId,
          quantity: lot.quantity,
          actorId: userId,
          createdAt: lot.createdAt,
          ...prices,
        }),
      });
    }

    summary.inventoriesCreated = lots.length;
    summary.movementsCreated = lots.length;
    return summary;
  }

  private async resolveMark(
    row: ImportableInventoryCsvRow,
    lookup: Map<string, MarkRecord>,
    summary: MutableImportSummary,
    tx: Prisma.TransactionClient,
  ): Promise<MarkRecord> {
    const key = normalizeNameKey(row.mark);
    const existing = lookup.get(key);

    if (existing) {
      return existing;
    }

    const created = await tx.productMark.create({
      data: { name: row.mark, createdAt: row.createdAt },
      select: { id: true, name: true },
    });

    lookup.set(key, created);
    summary.marksCreated += 1;
    return created;
  }

  private async resolveSpecification(
    row: ImportableInventoryCsvRow,
    lookup: Map<string, SpecificationRecord>,
    summary: MutableImportSummary,
    tx: Prisma.TransactionClient,
  ): Promise<SpecificationRecord> {
    const key = normalizeNameKey(row.specification);
    let specification = lookup.get(key);

    if (!specification) {
      specification = await tx.productSpecification.create({
        data: {
          specification: row.specification,
          createdAt: row.createdAt,
        },
        select: { id: true, specification: true, deletedAt: true },
      });
      lookup.set(key, specification);
      summary.specificationsCreated += 1;
      return specification;
    }

    if (specification.deletedAt) {
      specification = await tx.productSpecification.update({
        where: { id: specification.id },
        data: { deletedAt: null },
        select: { id: true, specification: true, deletedAt: true },
      });
      lookup.set(key, specification);
    }

    return specification;
  }

  private async resolveFormat(
    row: ImportableInventoryCsvRow,
    lookup: Map<string, FormatRecord>,
    summary: MutableImportSummary,
    tx: Prisma.TransactionClient,
  ): Promise<FormatRecord> {
    const key = normalizeNameKey(row.format);
    const existing = lookup.get(key);

    if (existing) {
      return existing;
    }

    const created = await tx.productFormat.create({
      data: { format: row.format, createdAt: row.createdAt },
      select: { id: true, format: true },
    });

    lookup.set(key, created);
    summary.formatsCreated += 1;
    return created;
  }

  private async resolveSupplier(
    row: ImportableInventoryCsvRow,
    lookup: Map<string, SupplierRecord>,
    summary: MutableImportSummary,
    userId: number,
    tx: Prisma.TransactionClient,
  ): Promise<SupplierRecord> {
    const key = normalizeNameKey(row.supplier);
    let supplier = lookup.get(key);

    if (!supplier) {
      supplier = await tx.supplier.create({
        data: {
          name: row.supplier,
          createdAt: row.createdAt,
          createdBy: userId,
        },
        select: { id: true, name: true, deletedAt: true },
      });
      lookup.set(key, supplier);
      summary.suppliersCreated += 1;
      return supplier;
    }

    if (supplier.deletedAt) {
      supplier = await tx.supplier.update({
        where: { id: supplier.id },
        data: { deletedAt: null, deletedBy: null, updatedBy: userId },
        select: { id: true, name: true, deletedAt: true },
      });
      lookup.set(key, supplier);
    }

    return supplier;
  }

  private async resolveProductType(
    row: ImportableInventoryCsvRow,
    lookup: Map<string, ProductTypeRecord>,
    summary: MutableImportSummary,
    tx: Prisma.TransactionClient,
  ): Promise<ProductTypeRecord> {
    const type = extractProductType(row.label, row);

    if (!type) {
      throw new BadRequestException(
        `Impossible d'extraire le type du produit à la ligne ${row.lineNumber}.`,
      );
    }

    const key = normalizeNameKey(type);
    const existing = lookup.get(key);

    if (existing) {
      return existing;
    }

    const created = await tx.productType.create({
      data: { type, createdAt: row.createdAt },
      select: { id: true, type: true },
    });

    lookup.set(key, created);
    summary.productTypesCreated += 1;
    return created;
  }

  private async resolveProducts(
    rows: readonly PreparedImportRow[],
    summary: MutableImportSummary,
    userId: number,
    tx: Prisma.TransactionClient,
  ): Promise<ResolvedInventoryImportRow[]> {
    const names = uniqueValues(rows.map((row) => row.productName));
    const references = uniqueValues(rows.map((row) => row.reference));
    const products = await tx.product.findMany({
      where: {
        OR: [
          ...names.map((name) => ({
            name: { equals: name, mode: Prisma.QueryMode.insensitive },
          })),
          { reference: { in: references } },
        ],
      },
      select: {
        id: true,
        name: true,
        reference: true,
        deletedAt: true,
      },
      orderBy: { id: 'asc' },
    });
    const productByName = createLookup<ProductRecord>(
      products,
      (product) => product.name,
    );
    const productByReference = createLookup<ProductRecord>(
      products,
      (product) => product.reference,
    );
    const resolvedRows: ResolvedInventoryImportRow[] = [];

    for (const row of rows) {
      const nameKey = normalizeNameKey(row.productName);
      let product = productByName.get(nameKey);

      if (!product) {
        const referenceOwner = productByReference.get(
          normalizeNameKey(row.reference),
        );

        if (referenceOwner) {
          throw new BadRequestException(
            `La référence « ${row.reference} » est déjà associée au produit « ${referenceOwner.name} » (ligne ${row.lineNumber}).`,
          );
        }

        try {
          product = await tx.product.create({
            data: {
              name: row.productName,
              reference: row.reference,
              markId: row.markId,
              specificationId: row.specificationId,
              formatId: row.formatId,
              productTypeId: row.productTypeId,
              createdAt: row.createdAt,
              createdBy: userId,
            },
            select: {
              id: true,
              name: true,
              reference: true,
              deletedAt: true,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new BadRequestException(
              `La référence « ${row.reference} » est déjà utilisée (ligne ${row.lineNumber}).`,
            );
          }

          throw error;
        }

        productByName.set(nameKey, product);
        productByReference.set(normalizeNameKey(product.reference), product);
        summary.productsCreated += 1;
      } else if (product.deletedAt) {
        product = await tx.product.update({
          where: { id: product.id },
          data: { deletedAt: null, deletedBy: null, updatedBy: userId },
          select: {
            id: true,
            name: true,
            reference: true,
            deletedAt: true,
          },
        });
        productByName.set(nameKey, product);
      }

      resolvedRows.push({ ...row, productId: product.id });
    }

    return resolvedRows;
  }
}

function createImportSummary(
  rowsProcessed: number,
  rowsSkipped: number,
  lotsSkipped: number,
): MutableImportSummary {
  return {
    rowsProcessed,
    rowsSkipped,
    inventoriesCreated: 0,
    lotsSkipped,
    movementsCreated: 0,
    productsCreated: 0,
    marksCreated: 0,
    specificationsCreated: 0,
    formatsCreated: 0,
    productTypesCreated: 0,
    suppliersCreated: 0,
  };
}

function createLookup<T>(
  records: readonly T[],
  readName: (record: T) => string,
): Map<string, T> {
  const lookup = new Map<string, T>();

  for (const record of records) {
    const key = normalizeNameKey(readName(record));

    if (!lookup.has(key)) {
      lookup.set(key, record);
    }
  }

  return lookup;
}

function uniqueValues(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}
