import { normalizeNameKey } from '../../products/utils/product-name.util';
import {
  InventoryCsvValidationError,
  type InventoryCsvRow,
} from './inventory-csv.util';

export interface ImportableInventoryCsvRow extends Omit<
  InventoryCsvRow,
  'purchasePrice'
> {
  purchasePrice: number;
  sourceLotNumber: number;
}

export interface ResolvedInventoryImportRow extends ImportableInventoryCsvRow {
  productId: number;
  supplierId: number;
}

export interface InventoryImportLot {
  productId: number;
  supplierId: number;
  createdAt: Date;
  purchasePrice: number;
  salePrice: number | undefined;
  wholesalePrice: number | undefined;
  quantity: number;
}

export interface ImportableRowsSelection {
  rows: ImportableInventoryCsvRow[];
  lotsSkipped: number;
  rowsSkipped: number;
}

export function selectImportableRows(
  rows: readonly InventoryCsvRow[],
): ImportableRowsSelection {
  const sourceLots: InventoryCsvRow[][] = [];

  for (const row of rows) {
    const currentLot = sourceLots[sourceLots.length - 1];
    const previousRow = currentLot?.[currentLot.length - 1];
    const belongsToCurrentLot =
      previousRow !== undefined &&
      normalizeNameKey(previousRow.label) === normalizeNameKey(row.label) &&
      normalizeNameKey(previousRow.supplier) ===
        normalizeNameKey(row.supplier) &&
      previousRow.createdAt.getTime() === row.createdAt.getTime() &&
      row.serialNumber === previousRow.serialNumber + 1;

    if (belongsToCurrentLot) {
      currentLot.push(row);
    } else {
      sourceLots.push([row]);
    }
  }

  const importableRows: ImportableInventoryCsvRow[] = [];
  let lotsSkipped = 0;
  let rowsSkipped = 0;

  sourceLots.forEach((lot, sourceLotNumber) => {
    if (lot.some((row) => row.purchasePrice === undefined)) {
      lotsSkipped += 1;
      rowsSkipped += lot.length;
      return;
    }

    const purchasePrice = readSinglePrice(lot, 'purchasePrice', 'prix net');
    const salePrice = readSinglePrice(lot, 'salePrice', 'prix détail');
    const wholesalePrice = readSinglePrice(lot, 'wholesalePrice', 'prix gros');

    if (purchasePrice === undefined) {
      return;
    }

    for (const row of lot) {
      importableRows.push({
        ...row,
        purchasePrice,
        salePrice,
        wholesalePrice,
        sourceLotNumber,
      });
    }
  });

  return { rows: importableRows, lotsSkipped, rowsSkipped };
}

export function buildInventoryImportLots(
  rows: readonly ResolvedInventoryImportRow[],
): InventoryImportLot[] {
  const rowsByLot = new Map<number, ResolvedInventoryImportRow[]>();

  for (const row of rows) {
    const lotRows = rowsByLot.get(row.sourceLotNumber);

    if (lotRows) {
      lotRows.push(row);
    } else {
      rowsByLot.set(row.sourceLotNumber, [row]);
    }
  }

  return Array.from(rowsByLot.values(), (lotRows) => {
    const firstRow = lotRows[0];

    if (!firstRow) {
      throw new InventoryCsvValidationError('Un lot CSV vide est invalide.');
    }

    return {
      productId: firstRow.productId,
      supplierId: firstRow.supplierId,
      createdAt: firstRow.createdAt,
      purchasePrice: firstRow.purchasePrice,
      salePrice: firstRow.salePrice,
      wholesalePrice: firstRow.wholesalePrice,
      quantity: lotRows.length,
    };
  });
}

function readSinglePrice(
  lot: readonly InventoryCsvRow[],
  field: 'purchasePrice' | 'salePrice' | 'wholesalePrice',
  columnName: string,
): number | undefined {
  const prices = Array.from(
    new Set(
      lot
        .map((row) => row[field])
        .filter((price): price is number => price !== undefined),
    ),
  );

  if (prices.length > 1) {
    throw new InventoryCsvValidationError(
      `La colonne « ${columnName} » contient plusieurs valeurs dans le lot commençant à la ligne ${lot[0]?.lineNumber ?? 1}.`,
    );
  }

  return prices[0];
}
