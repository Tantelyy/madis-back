import {
  CsvValidationError,
  normalizeCsvHeader,
  parseCsvBuffer,
  parseCsvDate,
  parseOptionalCsvPrice,
  type CsvRecord,
} from '../../common/utils/csv.util';
import { normalizeWhitespace } from '../../products/utils/product-name.util';

export { CsvValidationError as InventoryCsvValidationError } from '../../common/utils/csv.util';

type RequiredColumn =
  | 'date'
  | 'reference'
  | 'serialNumber'
  | 'label'
  | 'mark'
  | 'specification'
  | 'format'
  | 'supplier'
  | 'purchasePrice'
  | 'salePrice'
  | 'wholesalePrice';

const REQUIRED_HEADER_ALIASES: Readonly<
  Record<RequiredColumn, readonly string[]>
> = {
  date: ['date'],
  reference: ['ref madis', 'reference madis'],
  serialNumber: ['numero serie', 'no serie', 'n serie'],
  label: ['libelle'],
  mark: ['marque'],
  specification: ['specification'],
  format: ['format'],
  supplier: ['fournisseur'],
  purchasePrice: ['prix net'],
  salePrice: ['prix detail'],
  wholesalePrice: ['prix gros'],
};

type ColumnIndexes = Readonly<Record<RequiredColumn, number>>;

export interface InventoryCsvRow {
  lineNumber: number;
  createdAt: Date;
  reference: string;
  serialNumber: number;
  label: string;
  mark: string;
  specification: string;
  format: string;
  supplier: string;
  purchasePrice: number | undefined;
  salePrice: number | undefined;
  wholesalePrice: number | undefined;
}

export function parseInventoryCsv(buffer: Buffer): InventoryCsvRow[] {
  const records = parseCsvBuffer(buffer);
  const header = records[0];

  if (!header) {
    throw new CsvValidationError('Le fichier CSV est vide.');
  }

  const columnIndexes = buildColumnIndexes(header.cells);
  const dataRecords = records
    .slice(1)
    .filter((record) => record.cells.some((cell) => cell.trim().length > 0));

  if (dataRecords.length === 0) {
    throw new CsvValidationError(
      'Le fichier CSV ne contient aucune ligne de données.',
    );
  }

  return dataRecords.map((record) => parseInventoryRow(record, columnIndexes));
}

function buildColumnIndexes(headers: readonly string[]): ColumnIndexes {
  const normalizedHeaders = headers.map(normalizeCsvHeader);
  const findIndex = (column: RequiredColumn): number =>
    normalizedHeaders.findIndex((header) =>
      REQUIRED_HEADER_ALIASES[column].some((alias) => alias === header),
    );
  const indexes: ColumnIndexes = {
    date: findIndex('date'),
    reference: findIndex('reference'),
    serialNumber: findIndex('serialNumber'),
    label: findIndex('label'),
    mark: findIndex('mark'),
    specification: findIndex('specification'),
    format: findIndex('format'),
    supplier: findIndex('supplier'),
    purchasePrice: findIndex('purchasePrice'),
    salePrice: findIndex('salePrice'),
    wholesalePrice: findIndex('wholesalePrice'),
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
    date: 'date',
    reference: 'réf madis',
    serialNumber: 'numéro série',
    label: 'libellé',
    mark: 'marque',
    specification: 'spécification',
    format: 'format',
    supplier: 'fournisseur',
    purchasePrice: 'prix net',
    salePrice: 'prix détail',
    wholesalePrice: 'prix gros',
  };

  return labels[column];
}

function parseInventoryRow(
  record: CsvRecord,
  indexes: ColumnIndexes,
): InventoryCsvRow {
  return {
    lineNumber: record.lineNumber,
    createdAt: parseCsvDate(
      readRequiredCell(record, indexes.date, 'date'),
      record.lineNumber,
    ),
    reference: readRequiredCell(record, indexes.reference, 'réf madis'),
    serialNumber: parseSerialNumber(
      readRequiredCell(record, indexes.serialNumber, 'numéro série'),
      record.lineNumber,
    ),
    label: readRequiredCell(record, indexes.label, 'libellé'),
    mark: readRequiredCell(record, indexes.mark, 'marque'),
    specification: readRequiredCell(
      record,
      indexes.specification,
      'spécification',
    ),
    format: readRequiredCell(record, indexes.format, 'format'),
    supplier: readRequiredCell(record, indexes.supplier, 'fournisseur'),
    purchasePrice: parseOptionalCsvPrice(
      readCell(record, indexes.purchasePrice),
      'prix net',
      record.lineNumber,
    ),
    salePrice: parseOptionalCsvPrice(
      readCell(record, indexes.salePrice),
      'prix détail',
      record.lineNumber,
    ),
    wholesalePrice: parseOptionalCsvPrice(
      readCell(record, indexes.wholesalePrice),
      'prix gros',
      record.lineNumber,
    ),
  };
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

function parseSerialNumber(value: string, lineNumber: number): number {
  if (!/^\d+$/u.test(value)) {
    throw new CsvValidationError(
      `Le numéro de série est invalide à la ligne ${lineNumber}.`,
    );
  }

  const serialNumber = Number(value);

  if (!Number.isSafeInteger(serialNumber) || serialNumber < 1) {
    throw new CsvValidationError(
      `Le numéro de série est invalide à la ligne ${lineNumber}.`,
    );
  }

  return serialNumber;
}
