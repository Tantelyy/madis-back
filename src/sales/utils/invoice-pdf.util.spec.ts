import { generateInvoicePdf, type InvoiceData } from './invoice-pdf.util';

function createInvoice(lineCount: number): InvoiceData {
  return {
    saleId: 42,
    createdAt: new Date('2026-07-23T08:00:00.000Z'),
    customerName: 'Client test',
    customerContact: null,
    customerAddress: null,
    customerNif: '1234567890',
    customerStat: '987654321',
    company: {
      nif: 'NIF MADIS',
      stat: 'STAT MADIS',
      logoPath: 'assets/madis-logo.png',
    },
    sellerName: 'Vendeur',
    paymentMethod: 'CASH',
    status: 'CANCELLED',
    reason: 'Erreur de commande',
    totalPrice: '12000.00',
    lines: Array.from({ length: lineCount }, (_, index) => ({
      productName: `Produit ${index + 1}`,
      quantity: 1,
      freeQuantity: 0,
      unitPrice: '1000.00',
      totalPrice: '1000.00',
    })),
  };
}

describe('generateInvoicePdf', () => {
  it('produit un document PDF valide', async () => {
    const pdf = await generateInvoicePdf(createInvoice(2));
    const content = pdf.toString('latin1');

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(content).toContain('(Facture 42)');
    expect(content).toContain('/Type /Page');
    expect(content).toContain('%%EOF');
  });

  it('pagine les factures comportant de nombreuses lignes', async () => {
    const pdf = (await generateInvoicePdf(createInvoice(80))).toString('ascii');

    const pageCount = pdf.match(/\/Type \/Pages\s+\/Count (\d+)/)?.[1];

    expect(Number(pageCount)).toBeGreaterThan(1);
  });
});
