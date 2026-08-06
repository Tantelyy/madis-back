import {
  CsvValidationError,
  isUnavailableCsvValue,
  normalizeCsvHeader,
  parseCsvBuffer,
  parseCsvDate,
  parseOptionalCsvPrice,
  type CsvRecord,
} from '../../common/utils/csv.util';
import { normalizeWhitespace } from '../../products/utils/product-name.util';

export { CsvValidationError as SaleCsvValidationError } from '../../common/utils/csv.util';

type RequiredColumn =
  | 'inventoryDate'
  | 'reference'
  | 'status'
  | 'saleDate'
  | 'supplier'
  | 'retailPrice'
  | 'listedWholesalePrice'
  | 'wholesaleValue';

const REQUIRED_HEADER_ALIASES: Readonly<
  Record<RequiredColumn, readonly string[]>
> = {
  inventoryDate: ['date'],
  reference: ['ref madis', 'reference madis'],
  status: ['statut'],
  saleDate: ['ref stat', 'reference stat'],
  supplier: ['fournisseur'],
  retailPrice: ['detail'],
  listedWholesalePrice: ['prix gros', 'prix gros ar'],
  wholesaleValue: ['gros'],
};

type ColumnIndexes = Readonly<Record<RequiredColumn, number>>;

export interface SaleCsvRow {
  lineNumber: number;
  inventoryCreatedAt: Date;
  saleCreatedAt: Date;
  reference: string;
  supplier: string;
  wholesale: boolean;
  unitPrice: number;
}

export interface ParsedSaleCsv {
  rowsProcessed: number;
  rowsNotSold: number;
  rows: SaleCsvRow[];
}

export function parseSaleCsv(buffer: Buffer): ParsedSaleCsv {
  const records = parseCsvBuffer(buffer);
  const header = records[0];

  if (!header) {
    throw new CsvValidationError('Le fichier CSV est vide.');
  }

  const indexes = buildColumnIndexes(header.cells);
  const dataRecords = records
    .slice(1)
    .filter((record) => record.cells.some((cell) => cell.trim().length > 0));

  if (dataRecords.length === 0) {
    throw new CsvValidationError(
      'Le fichier CSV ne contient aucune ligne de données.',
    );
  }

  const rows: SaleCsvRow[] = [];
  let rowsNotSold = 0;

  for (const record of dataRecords) {
    const status = normalizeCsvHeader(readCell(record, indexes.status));

    if (status !== 'vendu') {
      rowsNotSold += 1;
      continue;
    }

    rows.push(parseSoldRow(record, indexes));
  }

  return {
    rowsProcessed: dataRecords.length,
    rowsNotSold,
    rows,
  };
}

function buildColumnIndexes(headers: readonly string[]): ColumnIndexes {
  const normalizedHeaders = headers.map(normalizeCsvHeader);
  const findIndex = (column: RequiredColumn): number =>
    normalizedHeaders.findIndex((header) =>
      REQUIRED_HEADER_ALIASES[column].includes(header),
    );
  const indexes: ColumnIndexes = {
    inventoryDate: findIndex('inventoryDate'),
    reference: findIndex('reference'),
    status: findIndex('status'),
    saleDate: findIndex('saleDate'),
    supplier: findIndex('supplier'),
    retailPrice: findIndex('retailPrice'),
    listedWholesalePrice: findIndex('listedWholesalePrice'),
    wholesaleValue: findIndex('wholesaleValue'),
  };
  const missingColumns = Object.entries(indexes)
    .filter(([, index]) => index < 0)
    .map(([column]) => formatColumnName(column as RequiredColumn));

  if (missingColumns.length > 0) {
    throw new CsvValidationError(
      `Colonnes CSV manquantes : ${missingColumns.join(', ')}.`,
    );
  }

  return indexes;
}

function formatColumnName(column: RequiredColumn): string {
  const labels: Readonly<Record<RequiredColumn, string>> = {
    inventoryDate: 'date',
    reference: 'réf madis',
    status: 'statut',
    saleDate: 'réf stat',
    supplier: 'fournisseur',
    retailPrice: 'détail',
    listedWholesalePrice: 'prix gros',
    wholesaleValue: 'gros',
  };

  return labels[column];
}

function parseSoldRow(record: CsvRecord, indexes: ColumnIndexes): SaleCsvRow {
  const wholesaleValue = readCell(record, indexes.wholesaleValue);
  const wholesale = !isFalseValue(wholesaleValue);
  const priceColumn = wholesale ? 'gros' : 'détail';
  const priceCell = resolvePriceCell(record, indexes, wholesaleValue);
  const unitPrice = parseOptionalCsvPrice(
    priceCell,
    priceColumn,
    record.lineNumber,
  );

  if (unitPrice === undefined || isUnavailableCsvValue(priceCell)) {
    throw new CsvValidationError(
      `La colonne « ${priceColumn} » doit contenir un prix supérieur à zéro à la ligne ${record.lineNumber}.`,
    );
  }

  return {
    lineNumber: record.lineNumber,
    inventoryCreatedAt: parseCsvDate(
      readRequiredCell(record, indexes.inventoryDate, 'date'),
      record.lineNumber,
    ),
    saleCreatedAt: parseCsvDate(
      readRequiredCell(record, indexes.saleDate, 'réf stat'),
      record.lineNumber,
    ),
    reference: readRequiredCell(record, indexes.reference, 'réf madis'),
    supplier: readRequiredCell(record, indexes.supplier, 'fournisseur'),
    wholesale,
    unitPrice,
  };
}

function isFalseValue(value: string): boolean {
  return ['false', 'faux'].includes(normalizeCsvHeader(value));
}

function resolvePriceCell(
  record: CsvRecord,
  indexes: ColumnIndexes,
  wholesaleValue: string,
): string {
  if (isFalseValue(wholesaleValue)) {
    return readCell(record, indexes.retailPrice);
  }

  if (['true', 'vrai'].includes(normalizeCsvHeader(wholesaleValue))) {
    return readCell(record, indexes.listedWholesalePrice);
  }

  return wholesaleValue;
}

function readCell(record: CsvRecord, index: number): string {
  return normalizeWhitespace(record.cells[index] ?? '');
}

function readRequiredCell(
  record: CsvRecord,
  index: number,
  columnName: string,
): string {
  const value = readCell(record, index);

  if (!value) {
    throw new CsvValidationError(
      `La colonne « ${columnName} » est vide à la ligne ${record.lineNumber}.`,
    );
  }

  return value;
}
