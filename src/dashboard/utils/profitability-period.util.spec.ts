import {
  buildProfitabilityBuckets,
  resolveProfitabilityGranularity,
} from './profitability-period.util';

describe('profitability period utilities', () => {
  const MADAGASCAR_OFFSET = -180;

  it('groups one local day by hour despite the UTC offset', () => {
    const from = new Date('2026-08-06T21:00:00.000Z');
    const to = new Date('2026-08-07T21:00:00.000Z');
    const granularity = resolveProfitabilityGranularity(
      from,
      to,
      MADAGASCAR_OFFSET,
    );
    const buckets = buildProfitabilityBuckets(
      from,
      to,
      MADAGASCAR_OFFSET,
      granularity,
    );

    expect(granularity).toBe('HOUR');
    expect(buckets).toHaveLength(24);
    expect(buckets[0]).toMatchObject({
      label: '00 h',
      from,
    });
    expect(buckets[23].label).toBe('23 h');
    expect(buckets[23].to).toEqual(to);
  });

  it('splits a month into Monday-to-Sunday weeks clipped to the period', () => {
    const from = new Date('2026-07-31T21:00:00.000Z');
    const to = new Date('2026-08-31T21:00:00.000Z');
    const granularity = resolveProfitabilityGranularity(
      from,
      to,
      MADAGASCAR_OFFSET,
    );
    const buckets = buildProfitabilityBuckets(
      from,
      to,
      MADAGASCAR_OFFSET,
      granularity,
    );

    expect(granularity).toBe('WEEK');
    expect(buckets.map((bucket) => bucket.label)).toEqual([
      '1–2 août',
      '3–9 août',
      '10–16 août',
      '17–23 août',
      '24–31 août',
    ]);
  });

  it('groups a full year by month', () => {
    const from = new Date('2025-12-31T21:00:00.000Z');
    const to = new Date('2026-12-31T21:00:00.000Z');
    const granularity = resolveProfitabilityGranularity(
      from,
      to,
      MADAGASCAR_OFFSET,
    );
    const buckets = buildProfitabilityBuckets(
      from,
      to,
      MADAGASCAR_OFFSET,
      granularity,
    );

    expect(granularity).toBe('MONTH');
    expect(buckets).toHaveLength(12);
    expect(buckets[0].label).toBe('janv. 2026');
    expect(buckets[11].label).toBe('déc. 2026');
  });
});
