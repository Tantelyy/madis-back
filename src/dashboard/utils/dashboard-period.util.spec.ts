import { BadRequestException } from '@nestjs/common';
import { parseDashboardPeriod } from './dashboard-period.util';

describe('parseDashboardPeriod', () => {
  it('returns valid exclusive period boundaries', () => {
    expect(
      parseDashboardPeriod({
        from: '2026-08-18T21:00:00.000Z',
        to: '2026-08-19T21:00:00.000Z',
      }),
    ).toEqual({
      from: new Date('2026-08-18T21:00:00.000Z'),
      to: new Date('2026-08-19T21:00:00.000Z'),
    });
  });

  it('rejects an empty or inverted period', () => {
    expect(() =>
      parseDashboardPeriod({
        from: '2026-08-19T21:00:00.000Z',
        to: '2026-08-19T21:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });
});
