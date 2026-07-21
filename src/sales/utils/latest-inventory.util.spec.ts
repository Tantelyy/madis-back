import { selectLatestInventory } from './latest-inventory.util';

describe('selectLatestInventory', () => {
  it('selects the most recently registered inventory lot', () => {
    const inventories = [
      { id: 1, createdAt: new Date('2026-07-21T15:54:00Z'), salePrice: 14970 },
      { id: 2, createdAt: new Date('2026-07-21T15:55:00Z'), salePrice: 15970 },
    ];

    expect(selectLatestInventory(inventories)?.salePrice).toBe(15970);
  });

  it('uses the highest id when two lots have the same creation date', () => {
    const createdAt = new Date('2026-07-21T15:55:00Z');

    expect(
      selectLatestInventory([
        { id: 8, createdAt },
        { id: 9, createdAt },
      ])?.id,
    ).toBe(9);
  });

  it('returns null when the product has no inventory lot', () => {
    expect(selectLatestInventory([])).toBeNull();
  });
});
