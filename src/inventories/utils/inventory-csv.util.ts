import { normalizeWhitespace } from '../../products/utils/product-name.util';

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

const UNAVAILABLE_PRICE_VALUES = new Set([
  '',
  'NA',
  'N/A',
  '#N/A',
  'NULL',
  'UNDEFINED',
  '*',
]);

interface CsvRecord {
  cells: string[];
  lineNumber: number;
}

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

export class InventoryCsvValidationError extends Error {}

export function parseInventoryCsv(buffer: Buffer): InventoryCsvRow[] {
  if (buffer.length === 0) {
    throw new InventoryCsvValidationError('Le fichier CSV est vide.');
  }

  const content = buffer.toString('utf8').replace(/^\uFEFF/u, '');

  if (content.includes('\u0000') || content.includes('\uFFFD')) {
    throw new InventoryCsvValidationError(
      'Le fichier CSV doit utiliser un encodage UTF-8 valide.',
    );
  }

  const records = selectCsvRecords(content);
  const header = records[0];

  if (!header) {
    throw new InventoryCsvValidationError('Le fichier CSV est vide.');
  }

  const columnIndexes = buildColumnIndexes(header.cells);
  const dataRecords = records
    .slice(1)
    .filter((record) => record.cells.some((cell) => cell.trim().length > 0));

  if (dataRecords.length === 0) {
    throw new InventoryCsvValidationError(
      'Le fichier CSV ne contient aucune ligne de données.',
    );
  }

  return dataRecords.map((record) => parseInventoryRow(record, columnIndexes));
}

function selectCsvRecords(content: string): CsvRecord[] {
  const candidates = [',', ';'].map((delimiter) => {
    try {
      const records = parseCsvRecords(content, delimiter);
      const headers = records[0]?.cells ?? [];

      return {
        records,
        matchingHeaders: countMatchingHeaders(headers),
      };
    } catch {
      return { records: [], matchingHeaders: -1 };
    }
  });
  const bestCandidate = candidates.sort(
    (first, second) => second.matchingHeaders - first.matchingHeaders,
  )[0];

  if (!bestCandidate) {
    throw new InventoryCsvValidationError('Le fichier CSV est invalide.');
  }

  return bestCandidate.records;
}

function parseCsvRecords(content: string, delimiter: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let isQuoted = false;
  let lineNumber = 1;
  let recordLineNumber = 1;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (isQuoted) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          isQuoted = false;
        }
      } else {
        cell += character;

        if (character === '\n') {
          lineNumber += 1;
        }
      }

      continue;
    }

    if (character === '"') {
      if (cell.length > 0) {
        throw new InventoryCsvValidationError(
          `Guillemet CSV inattendu à la ligne ${lineNumber}.`,
        );
      }

      isQuoted = true;
      continue;
    }

    if (character === delimiter) {
      cells.push(cell);
      cell = '';
      continue;
    }

    if (character === '\r' || character === '\n') {
      cells.push(cell);
      records.push({ cells, lineNumber: recordLineNumber });
      cells = [];
      cell = '';

      if (character === '\r' && content[index + 1] === '\n') {
        index += 1;
      }

      lineNumber += 1;
      recordLineNumber = lineNumber;
      continue;
    }

    cell += character;
  }

  if (isQuoted) {
    throw new InventoryCsvValidationError(
      `Champ CSV non fermé à partir de la ligne ${recordLineNumber}.`,
    );
  }

  if (cell.length > 0 || cells.length > 0) {
    cells.push(cell);
    records.push({ cells, lineNumber: recordLineNumber });
  }

  return records;
}

function countMatchingHeaders(headers: readonly string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  const requiredColumns = Object.keys(
    REQUIRED_HEADER_ALIASES,
  ) as RequiredColumn[];

  return requiredColumns.filter((column) =>
    REQUIRED_HEADER_ALIASES[column].some((alias) =>
      normalizedHeaders.includes(alias),
    ),
  ).length;
}

function buildColumnIndexes(headers: readonly string[]): ColumnIndexes {
  const normalizedHeaders = headers.map(normalizeHeader);
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
    throw new InventoryCsvValidationError(
      `Colonnes CSV manquantes : ${missingColumns.join(', ')}.`,
    );
  }

  return indexes;
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
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
    createdAt: parseDate(
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
    purchasePrice: parseOptionalPrice(
      readCell(record, indexes.purchasePrice),
      'prix net',
      record.lineNumber,
    ),
    salePrice: parseOptionalPrice(
      readCell(record, indexes.salePrice),
      'prix détail',
      record.lineNumber,
    ),
    wholesalePrice: parseOptionalPrice(
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
    throw new InventoryCsvValidationError(
      `La colonne « ${columnName} » est vide à la ligne ${record.lineNumber}.`,
    );
  }

  return value;
}

function parseSerialNumber(value: string, lineNumber: number): number {
  if (!/^\d+$/u.test(value)) {
    throw new InventoryCsvValidationError(
      `Le numéro de série est invalide à la ligne ${lineNumber}.`,
    );
  }

  const serialNumber = Number(value);

  if (!Number.isSafeInteger(serialNumber) || serialNumber < 1) {
    throw new InventoryCsvValidationError(
      `Le numéro de série est invalide à la ligne ${lineNumber}.`,
    );
  }

  return serialNumber;
}

function parseOptionalPrice(
  value: string,
  columnName: string,
  lineNumber: number,
): number | undefined {
  const normalizedValue = value.toLocaleUpperCase('fr');

  if (UNAVAILABLE_PRICE_VALUES.has(normalizedValue)) {
    return undefined;
  }

  const compactValue = value
    .replace(/^ar\s*/iu, '')
    .replace(/[\s\u202F\u00A0]/gu, '');

  if (!/^\d+(?:[,.]\d{1,2})?$/u.test(compactValue)) {
    throw new InventoryCsvValidationError(
      `La colonne « ${columnName} » contient un prix invalide à la ligne ${lineNumber}.`,
    );
  }

  const price = Number(compactValue.replace(',', '.'));

  if (!Number.isFinite(price) || price < 0) {
    throw new InventoryCsvValidationError(
      `La colonne « ${columnName} » contient un prix invalide à la ligne ${lineNumber}.`,
    );
  }

  return price === 0 ? undefined : price;
}

function parseDate(value: string, lineNumber: number): Date {
  const match =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/u.exec(
      value,
    );

  if (!match) {
    throw new InventoryCsvValidationError(
      `La date est invalide à la ligne ${lineNumber}. Format attendu : JJ/MM/AAAA HH:mm:ss.`,
    );
  }

  const [
    ,
    dayValue,
    monthValue,
    yearValue,
    hourValue,
    minuteValue,
    secondValue,
  ] = match;
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);
  const hour = Number(hourValue ?? 0);
  const minute = Number(minuteValue ?? 0);
  const second = Number(secondValue ?? 0);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new InventoryCsvValidationError(
      `La date est invalide à la ligne ${lineNumber}.`,
    );
  }

  return date;
}
