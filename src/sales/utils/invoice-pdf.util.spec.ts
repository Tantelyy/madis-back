import { generateInvoicePdf, type InvoiceData } from './invoice-pdf.util';

function createInvoice(lineCount: number): InvoiceData {
  return {
    saleId: 42,
    createdAt: new Date('2026-07-23T08:00:00.000Z'),
    customerName: 'Client test',
    customerContact: null,
    customerAddress: null,
    sellerName: 'Vendeur',
    paymentMethod: 'CASH',
    totalPrice: '12000.00',
    lines: Array.from({ length: lineCount }, (_, index) => ({
      productName: `Produit ${index + 1}`,
      reference: `REF-${index + 1}`,
      quantity: 1,
      freeQuantity: 0,
      unitPrice: '1000.00',
      totalPrice: '1000.00',
    })),
  };
}

describe('generateInvoicePdf', () => {
  it('produit un document PDF valide', () => {
    const pdf = generateInvoicePdf(createInvoice(2));
    const content = pdf.toString('latin1');

    expect(pdf.subarray(0, 8).toString('ascii')).toBe('%PDF-1.4');
    expect(content).toContain('FACTURE N° 42');
    expect(content).toContain('juillet 2026 à');
    expect(content).toContain('Espèces');
    expect(content).toContain('%%EOF');
  });

  it('pagine les factures comportant de nombreuses lignes', () => {
    const pdf = generateInvoicePdf(createInvoice(80)).toString('ascii');

    expect(pdf).toContain('/Count 3');
    expect(pdf).toContain('Page 3/3');
  });
});
