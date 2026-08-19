import { BadRequestException } from '@nestjs/common';
import { buildDateRangeFilter } from './date-range.util';

describe('buildDateRangeFilter', () => {
  it("inclut entièrement les deux dates de l'intervalle", () => {
    expect(
      buildDateRangeFilter({
        startDate: '2026-08-01',
        endDate: '2026-08-12',
      }),
    ).toEqual({
      gte: new Date('2026-07-31T21:00:00.000Z'),
      lt: new Date('2026-08-12T21:00:00.000Z'),
    });
  });

  it('retourne undefined sans borne', () => {
    expect(buildDateRangeFilter({})).toBeUndefined();
  });

  it('refuse un intervalle inversé', () => {
    expect(() =>
      buildDateRangeFilter({
        startDate: '2026-08-12',
        endDate: '2026-08-01',
      }),
    ).toThrow(BadRequestException);
  });

  it('refuse une date inexistante', () => {
    expect(() => buildDateRangeFilter({ startDate: '2026-02-30' })).toThrow(
      BadRequestException,
    );
  });
});
