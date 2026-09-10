import type { InventoryCsvRow } from './inventory-csv.util';
import {
  buildInventoryImportLots,
  selectImportableRows,
  type ResolvedInventoryImportRow,
} from './inventory-import-lot.util';

function createRow(
  serialNumber: number,
  purchasePrice: number | undefined = 100,
): InventoryCsvRow {
  return {
    lineNumber: serialNumber + 1,
    createdAt: new Date('2026-04-23T00:00:00.000Z'),
    reference: 'REF-1',
    serialNumber,
    label: 'Lait PRE FRANCE LAIT 400g',
    mark: 'FRANCE LAIT',
    specification: 'PRE',
    format: '400g',
    supplier: 'NETTER',
    purchasePrice,
    salePrice: undefined,
    wholesalePrice: 110,
  };
}

describe('inventory import lots', () => {
  it('groups consecutive serial numbers and starts a new lot after a gap', () => {
    const selection = selectImportableRows([
      createRow(1),
      createRow(2),
      createRow(4),
    ]);
    const resolvedRows = selection.rows.map<ResolvedInventoryImportRow>(
      (row) => ({ ...row, productId: 1, supplierId: 2 }),
    );

    expect(
      buildInventoryImportLots(resolvedRows).map((lot) => lot.quantity),
    ).toEqual([2, 1]);
  });

  it('skips the entire lot when one row has no net price', () => {
    const selection = selectImportableRows([
      createRow(1),
      { ...createRow(2), purchasePrice: undefined },
      createRow(4),
    ]);

    expect(selection.rows).toHaveLength(1);
    expect(selection.lotsSkipped).toBe(1);
    expect(selection.rowsSkipped).toBe(2);
  });
});
