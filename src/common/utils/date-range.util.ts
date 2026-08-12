import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface DateRangeInput {
  startDate?: string;
  endDate?: string;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MADAGASCAR_UTC_OFFSET = 3 * 60 * 60 * 1000;

function parseDateOnly(value: string): Date {
  const utcDate = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(utcDate.getTime()) ||
    utcDate.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('La date renseignée est invalide.');
  }

  return new Date(utcDate.getTime() - MADAGASCAR_UTC_OFFSET);
}

export function buildDateRangeFilter({
  startDate,
  endDate,
}: DateRangeInput): Prisma.DateTimeFilter | undefined {
  if (!startDate && !endDate) {
    return undefined;
  }

  const start = startDate ? parseDateOnly(startDate) : undefined;
  const end = endDate ? parseDateOnly(endDate) : undefined;

  if (start && end && start.getTime() > end.getTime()) {
    throw new BadRequestException(
      'La date de début doit être antérieure ou égale à la date de fin.',
    );
  }

  return {
    gte: start,
    lt: end ? new Date(end.getTime() + MILLISECONDS_PER_DAY) : undefined,
  };
}
