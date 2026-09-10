import { BadRequestException } from '@nestjs/common';
import type { DashboardPeriodQueryDto } from '../dto/dashboard-period-query.dto';

export interface ParsedDashboardPeriod {
  from: Date;
  to: Date;
}

export function parseDashboardPeriod(
  query: Pick<DashboardPeriodQueryDto, 'from' | 'to'>,
): ParsedDashboardPeriod {
  const from = new Date(query.from);
  const to = new Date(query.to);

  if (from >= to) {
    throw new BadRequestException(
      'La date de fin doit être postérieure à la date de début.',
    );
  }

  return { from, to };
}
