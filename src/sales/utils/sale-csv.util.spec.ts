import { parseSaleCsv, SaleCsvValidationError } from './sale-csv.util';

describe('parseSaleCsv', () => {
  it('uses Réf Stat as the sale date and Détail for a retail sale', () => {
    const csv = [
      'Date,Réf MADIS,N°Série,Statut,Réf Stat,Libellé,Marque,Spécification,Format,Fournisseur,Prix Net,Prix Détail,Prix Gros,Détail,Gros',
      '23/4/2026,REF-1,1,Vendu,24/4/2026 10:11:12,Produit,Marque,Spec,1pc,Fournisseur,100,140,130,"Ar 145,50",FALSE',
    ].join('\r\n');

    expect(parseSaleCsv(Buffer.from(csv))).toEqual({
      rowsProcessed: 1,
      rowsNotSold: 0,
      rows: [
        {
          lineNumber: 2,
          inventoryCreatedAt: new Date('2026-04-23T00:00:00.000Z'),
          saleCreatedAt: new Date('2026-04-24T10:11:12.000Z'),
          reference: 'REF-1',
          supplier: 'Fournisseur',
          wholesale: false,
          unitPrice: 145.5,
        },
      ],
    });
  });

  it('uses Gros as the unit price for a wholesale sale', () => {
    const csv = [
      'Date;Réf MADIS;Statut;Réf Stat;Fournisseur;Prix Gros;Détail;Gros',
      '23/4/2026;REF-1;Vendu;25/4/2026 08:00:00;Fournisseur;120;FALSE;125',
    ].join('\n');

    expect(parseSaleCsv(Buffer.from(csv)).rows[0]).toMatchObject({
      wholesale: true,
      unitPrice: 125,
      saleCreatedAt: new Date('2026-04-25T08:00:00.000Z'),
    });
  });

  it('uses Prix Gros when Gros ? is a true boolean indicator', () => {
    const csv = [
      'Date,Réf MADIS,Statut,Réf Stat,Fournisseur,Prix Gros (Ar),Détail,Gros ?',
      '23/4/2026,REF-1,Vendu,25/4/2026 08:00:00,Fournisseur,125,140,TRUE',
    ].join('\n');

    expect(parseSaleCsv(Buffer.from(csv)).rows[0]).toMatchObject({
      wholesale: true,
      unitPrice: 125,
    });
  });

  it('parses converter exports whose complete data rows are quoted', () => {
    const csv = [
      'Date,Réf MADIS,N° Série,Statut,Réf Stat,Libellé,Marque,Spécification,Format,Fournisseur,Prix Net (Ar),Prix Détail (Ar),Prix Gros (Ar),Détail,Gros ?',
      '"23/04/2026,REF-1,1,Vendu,04/05/2026 00:34,Produit,Marque,Spec,1pc,Fournisseur,""15 600,00"",""16 500,00"",""16 000,00"",""16 500,00"",FALSE"',
    ].join('\n');

    expect(parseSaleCsv(Buffer.from(csv))).toEqual({
      rowsProcessed: 1,
      rowsNotSold: 0,
      rows: [
        {
          lineNumber: 2,
          inventoryCreatedAt: new Date('2026-04-23T00:00:00.000Z'),
          saleCreatedAt: new Date('2026-05-04T00:34:00.000Z'),
          reference: 'REF-1',
          supplier: 'Fournisseur',
          wholesale: false,
          unitPrice: 16500,
        },
      ],
    });
  });

  it('ignores rows whose status is not Vendu before validating their data', () => {
    const csv = [
      'Date,Réf MADIS,Statut,Réf Stat,Fournisseur,Prix Gros,Détail,Gros',
      ',REF-1,Disponible,,,130,140,FALSE',
    ].join('\n');

    expect(parseSaleCsv(Buffer.from(csv))).toEqual({
      rowsProcessed: 1,
      rowsNotSold: 1,
      rows: [],
    });
  });

  it('reports missing required columns', () => {
    expect(() =>
      parseSaleCsv(Buffer.from('Date,Statut\n23/4/2026,Vendu')),
    ).toThrow(SaleCsvValidationError);
  });
});
