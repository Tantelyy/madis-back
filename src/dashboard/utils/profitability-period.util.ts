import type { ProfitabilityGranularity } from '../interfaces/profitability.interface';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;
const MINUTE_IN_MILLISECONDS = 60 * 1_000;
const LONG_PERIOD_THRESHOLD_IN_DAYS = 62;

export interface ProfitabilityBucket {
  key: string;
  label: string;
  from: Date;
  to: Date;
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

export function resolveProfitabilityGranularity(
  from: Date,
  to: Date,
  timezoneOffset: number,
): ProfitabilityGranularity {
  const localFrom = toLocalClock(from, timezoneOffset);
  const localLastInstant = toLocalClock(
    new Date(to.getTime() - 1),
    timezoneOffset,
  );
  const isSingleDay =
    localFrom.getUTCFullYear() === localLastInstant.getUTCFullYear() &&
    localFrom.getUTCMonth() === localLastInstant.getUTCMonth() &&
    localFrom.getUTCDate() === localLastInstant.getUTCDate();

  if (isSingleDay) {
    return 'HOUR';
  }

  const durationInDays = (to.getTime() - from.getTime()) / DAY_IN_MILLISECONDS;

  return durationInDays > LONG_PERIOD_THRESHOLD_IN_DAYS ? 'MONTH' : 'WEEK';
}

export function buildProfitabilityBuckets(
  from: Date,
  to: Date,
  timezoneOffset: number,
  granularity: ProfitabilityGranularity,
): ProfitabilityBucket[] {
  const buckets: ProfitabilityBucket[] = [];
  let cursor = new Date(from);

  while (cursor < to) {
    const candidateEnd = getNextBucketStart(
      cursor,
      timezoneOffset,
      granularity,
    );
    const bucketEnd = candidateEnd < to ? candidateEnd : new Date(to);

    buckets.push({
      key: cursor.toISOString(),
      label: formatBucketLabel(cursor, bucketEnd, timezoneOffset, granularity),
      from: new Date(cursor),
      to: bucketEnd,
    });
    cursor = bucketEnd;
  }

  mergeSingleDayTrailingWeek(buckets, timezoneOffset, granularity);

  return buckets;
}

export function findBucketIndex(
  buckets: readonly ProfitabilityBucket[],
  value: Date,
): number {
  const timestamp = value.getTime();

  return buckets.findIndex(
    (bucket) =>
      timestamp >= bucket.from.getTime() && timestamp < bucket.to.getTime(),
  );
}

function getNextBucketStart(
  cursor: Date,
  timezoneOffset: number,
  granularity: ProfitabilityGranularity,
): Date {
  const localCursor = toLocalClock(cursor, timezoneOffset);

  if (granularity === 'HOUR') {
    return fromLocalClock(
      new Date(
        Date.UTC(
          localCursor.getUTCFullYear(),
          localCursor.getUTCMonth(),
          localCursor.getUTCDate(),
          localCursor.getUTCHours() + 1,
        ),
      ),
      timezoneOffset,
    );
  }

  if (granularity === 'MONTH') {
    return fromLocalClock(
      new Date(
        Date.UTC(
          localCursor.getUTCFullYear(),
          localCursor.getUTCMonth() + 1,
          1,
        ),
      ),
      timezoneOffset,
    );
  }

  const currentWeekDay = localCursor.getUTCDay();
  const daysUntilNextMonday = currentWeekDay === 0 ? 1 : 8 - currentWeekDay;

  return fromLocalClock(
    new Date(
      Date.UTC(
        localCursor.getUTCFullYear(),
        localCursor.getUTCMonth(),
        localCursor.getUTCDate() + daysUntilNextMonday,
      ),
    ),
    timezoneOffset,
  );
}

function formatBucketLabel(
  from: Date,
  to: Date,
  timezoneOffset: number,
  granularity: ProfitabilityGranularity,
): string {
  const localFrom = toLocalClock(from, timezoneOffset);

  if (granularity === 'HOUR') {
    return `${String(localFrom.getUTCHours()).padStart(2, '0')} h`;
  }

  if (granularity === 'MONTH') {
    return new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(localFrom);
  }

  const localLastDay = toLocalClock(new Date(to.getTime() - 1), timezoneOffset);

  return formatWeekLabel(localFrom, localLastDay);
}

function formatWeekLabel(from: Date, to: Date): string {
  const fromParts = getLocalDateParts(from);
  const toParts = getLocalDateParts(to);
  const sameMonth =
    fromParts.year === toParts.year && fromParts.month === toParts.month;
  const sameYear = fromParts.year === toParts.year;
  const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    timeZone: 'UTC',
  });
  const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const yearFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  if (sameMonth && fromParts.day === toParts.day) {
    return monthFormatter.format(to);
  }

  if (sameMonth) {
    return `${dayFormatter.format(from)}–${monthFormatter.format(to)}`;
  }

  if (sameYear) {
    return `${monthFormatter.format(from)}–${monthFormatter.format(to)}`;
  }

  return `${yearFormatter.format(from)}–${yearFormatter.format(to)}`;
}

function mergeSingleDayTrailingWeek(
  buckets: ProfitabilityBucket[],
  timezoneOffset: number,
  granularity: ProfitabilityGranularity,
): void {
  if (granularity !== 'WEEK' || buckets.length < 2) {
    return;
  }

  const lastBucket = buckets[buckets.length - 1];
  const lastBucketDuration =
    lastBucket.to.getTime() - lastBucket.from.getTime();

  if (lastBucketDuration > DAY_IN_MILLISECONDS) {
    return;
  }

  const previousBucket = buckets[buckets.length - 2];
  previousBucket.to = lastBucket.to;
  previousBucket.label = formatBucketLabel(
    previousBucket.from,
    previousBucket.to,
    timezoneOffset,
    granularity,
  );
  buckets.pop();
}

function getLocalDateParts(value: Date): LocalDateParts {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth(),
    day: value.getUTCDate(),
  };
}

function toLocalClock(value: Date, timezoneOffset: number): Date {
  return new Date(value.getTime() - timezoneOffset * MINUTE_IN_MILLISECONDS);
}

function fromLocalClock(value: Date, timezoneOffset: number): Date {
  return new Date(value.getTime() + timezoneOffset * MINUTE_IN_MILLISECONDS);
}
