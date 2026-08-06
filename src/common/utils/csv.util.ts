const UNAVAILABLE_VALUES = new Set([
  '',
  'NA',
  'N/A',
  '#N/A',
  'NULL',
  'UNDEFINED',
  '*',
]);

export interface CsvRecord {
  cells: string[];
  lineNumber: number;
}

export class CsvValidationError extends Error {}

export function parseCsvBuffer(buffer: Buffer): CsvRecord[] {
  if (buffer.length === 0) {
    throw new CsvValidationError('Le fichier CSV est vide.');
  }

  const content = buffer.toString('utf8').replace(/^\uFEFF/u, '');

  if (content.includes('\u0000') || content.includes('\uFFFD')) {
    throw new CsvValidationError(
      'Le fichier CSV doit utiliser un encodage UTF-8 valide.',
    );
  }

  const candidates = [',', ';'].map((delimiter) => {
    try {
      const records = parseCsvRecords(content, delimiter);

      return {
        records: normalizeWrappedCsvRecords(records, delimiter),
        headerCount: records[0]?.cells.length ?? 0,
      };
    } catch {
      return { records: [], headerCount: -1 };
    }
  });
  const bestCandidate = candidates.sort(
    (first, second) => second.headerCount - first.headerCount,
  )[0];

  if (!bestCandidate || bestCandidate.records.length === 0) {
    throw new CsvValidationError('Le fichier CSV est invalide.');
  }

  return bestCandidate.records;
}

function normalizeWrappedCsvRecords(
  records: readonly CsvRecord[],
  delimiter: string,
): CsvRecord[] {
  const headerColumnCount = records[0]?.cells.length ?? 0;

  if (headerColumnCount <= 1) {
    return [...records];
  }

  return records.map((record, index) => {
    const wrappedValue = record.cells[0];

    if (
      index === 0 ||
      record.cells.length !== 1 ||
      !wrappedValue?.includes(delimiter)
    ) {
      return record;
    }

    const nestedRecords = parseCsvRecords(wrappedValue, delimiter);

    if (nestedRecords.length !== 1 || nestedRecords[0].cells.length <= 1) {
      return record;
    }

    return {
      cells: nestedRecords[0].cells,
      lineNumber: record.lineNumber,
    };
  });
}

export function normalizeCsvHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

export function parseCsvDate(value: string, lineNumber: number): Date {
  const match =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/u.exec(
      value,
    );

  if (!match) {
    throw new CsvValidationError(
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
    throw new CsvValidationError(
      `La date est invalide à la ligne ${lineNumber}.`,
    );
  }

  return date;
}

export function parseOptionalCsvPrice(
  value: string,
  columnName: string,
  lineNumber: number,
): number | undefined {
  const normalizedValue = value.trim().toLocaleUpperCase('fr');

  if (UNAVAILABLE_VALUES.has(normalizedValue)) {
    return undefined;
  }

  const compactValue = value
    .replace(/^ar\s*/iu, '')
    .replace(/[\s\u202F\u00A0]/gu, '');

  if (!/^\d+(?:[,.]\d{1,2})?$/u.test(compactValue)) {
    throw new CsvValidationError(
      `La colonne « ${columnName} » contient un prix invalide à la ligne ${lineNumber}.`,
    );
  }

  const price = Number(compactValue.replace(',', '.'));

  if (!Number.isFinite(price) || price < 0) {
    throw new CsvValidationError(
      `La colonne « ${columnName} » contient un prix invalide à la ligne ${lineNumber}.`,
    );
  }

  return price === 0 ? undefined : price;
}

export function isUnavailableCsvValue(value: string): boolean {
  return UNAVAILABLE_VALUES.has(value.trim().toLocaleUpperCase('fr'));
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
        throw new CsvValidationError(
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
    throw new CsvValidationError(
      `Champ CSV non fermé à partir de la ligne ${recordLineNumber}.`,
    );
  }

  if (cell.length > 0 || cells.length > 0) {
    cells.push(cell);
    records.push({ cells, lineNumber: recordLineNumber });
  }

  return records;
}
