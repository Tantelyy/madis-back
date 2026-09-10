import {
  InventoryCsvValidationError,
  parseInventoryCsv,
} from './inventory-csv.util';

describe('parseInventoryCsv', () => {
  it('parses Ariary prices and unavailable price markers', () => {
    const csv = [
      'Date,Réf MADIS,N°Série,Libellé,Marque,Spécification,Format,Fournisseur,Prix Net,Prix Détail,Prix Gros',
      '23/4/2026,REF-1,1,Couches TWIN MINI PIKABOO 40pc,PIKABOO,TWIN MINI,40pc,PIKABOO,"Ar15 600,00",#N/A,*',
    ].join('\r\n');

    expect(parseInventoryCsv(Buffer.from(csv))).toEqual([
      {
        lineNumber: 2,
        createdAt: new Date('2026-04-23T00:00:00.000Z'),
        reference: 'REF-1',
        serialNumber: 1,
        label: 'Couches TWIN MINI PIKABOO 40pc',
        mark: 'PIKABOO',
        specification: 'TWIN MINI',
        format: '40pc',
        supplier: 'PIKABOO',
        purchasePrice: 15600,
        salePrice: undefined,
        wholesalePrice: undefined,
      },
    ]);
  });

  it.each(['', '0', 'Ar0,00', 'NA', 'null', 'undefined', '#N/A'])(
    'treats an unavailable or zero net price (%s) as missing',
    (purchasePrice) => {
      const csv = [
        'date;réf madis;numéro série;libellé;marque;spécification;format;fournisseur;prix net;prix détail;prix gros',
        `23/4/2026;REF-1;1;Lait PRE FRANCE LAIT 400g;FRANCE LAIT;PRE;400g;NETTER;${purchasePrice};100;90`,
      ].join('\n');

      expect(
        parseInventoryCsv(Buffer.from(csv))[0]?.purchasePrice,
      ).toBeUndefined();
    },
  );

  it('reports missing required columns', () => {
    expect(() =>
      parseInventoryCsv(Buffer.from('date,libellé\n23/4/2026,Lait')),
    ).toThrow(InventoryCsvValidationError);
  });
});
