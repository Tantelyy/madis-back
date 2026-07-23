export interface InvoiceLine {
  productName: string;
  reference: string;
  quantity: number;
  freeQuantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface InvoiceData {
  saleId: number;
  createdAt: Date;
  customerName: string;
  customerContact: string | null;
  customerAddress: string | null;
  sellerName: string;
  paymentMethod: string | null;
  status: string;
  reason: string | null;
  totalPrice: string;
  lines: InvoiceLine[];
}

const PAGE_HEIGHT = 842;
const PAGE_WIDTH = 595;
const LEFT_MARGIN = 48;

function sanitizePdfText(value: string): string {
  return value
    .replace(/Œ/g, '\x8c')
    .replace(/œ/g, '\x9c')
    .replace(/’/g, '\x92')
    .replace(/“/g, '\x93')
    .replace(/”/g, '\x94')
    .replace(/–/g, '\x96')
    .replace(/—/g, '\x97')
    .replace(/€/g, '\x80')
    .replace(/[^\x20-\x7e\x80-\xff]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatInvoiceDate(value: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Indian/Antananarivo',
  }).format(value);
}

function addText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  size = 10,
): void {
  commands.push(
    `BT /F1 ${size} Tf ${x} ${y} Td (${sanitizePdfText(text)}) Tj ET`,
  );
}

function buildPdfDocument(contents: readonly string[]): Buffer {
  const fontObjectId = 3 + contents.length * 2;
  const pageObjectIds = contents.map((_, index) => 3 + index * 2);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${contents.length} >>`,
  ];

  contents.forEach((content, index) => {
    const contentObjectId = pageObjectIds[index] + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    );
  });
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );
  let document = '%PDF-1.4\n';
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document, 'latin1'));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(document, 'latin1');
  document += `xref\n0 ${objects.length + 1}\n`;
  document += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    document += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  document += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(document, 'latin1');
}

export function generateInvoicePdf(invoice: InvoiceData): Buffer {
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = 0;

  function startPage(includeCustomer: boolean): void {
    commands = [];
    pages.push(commands);
    y = PAGE_HEIGHT - 55;
    addText(commands, 'MA DISTRIBUTION', LEFT_MARGIN, y, 18);
    addText(commands, `FACTURE N° ${invoice.saleId}`, 380, y, 15);
    y -= 32;
    addText(
      commands,
      `Date : ${formatInvoiceDate(invoice.createdAt)}`,
      LEFT_MARGIN,
      y,
    );
    addText(commands, `Vendeur : ${invoice.sellerName}`, 330, y);
    y -= 35;

    if (includeCustomer) {
      addText(commands, `Client : ${invoice.customerName}`, LEFT_MARGIN, y, 12);
      y -= 18;
      addText(
        commands,
        `Contact : ${invoice.customerContact || '-'}`,
        LEFT_MARGIN,
        y,
      );
      y -= 18;
      addText(
        commands,
        `Adresse : ${invoice.customerAddress || '-'}`,
        LEFT_MARGIN,
        y,
      );
      y -= 35;
    }

    addText(commands, 'Produit', LEFT_MARGIN, y, 10);
    addText(commands, 'Qté', 350, y, 10);
    addText(commands, 'P.U.', 405, y, 10);
    addText(commands, 'Total', 490, y, 10);
    commands.push(`${LEFT_MARGIN} ${y - 7} m 547 ${y - 7} l S`);
    y -= 25;
  }

  startPage(true);

  invoice.lines.forEach((line) => {
    const requiredHeight = line.freeQuantity > 0 ? 34 : 17;

    if (y - requiredHeight < 95) {
      startPage(false);
    }

    const label = `${line.productName} (${line.reference})`.slice(0, 48);
    addText(commands, label, LEFT_MARGIN, y);
    addText(commands, String(line.quantity), 350, y);
    addText(commands, `${line.unitPrice} Ar`, 405, y);
    addText(commands, `${line.totalPrice} Ar`, 490, y);
    y -= 17;
    if (line.freeQuantity > 0) {
      addText(
        commands,
        `  + ${line.freeQuantity} offert(s)`,
        LEFT_MARGIN,
        y,
        9,
      );
      y -= 17;
    }
  });

  if (y < 150) {
    startPage(false);
  }

  commands.push(`${LEFT_MARGIN} ${y} m 547 ${y} l S`);
  y -= 28;
  addText(commands, `TOTAL : ${invoice.totalPrice} Ar`, 390, y, 14);
  y -= 24;
  addText(
    commands,
    `Paiement : ${formatPaymentMethod(invoice.paymentMethod)}`,
    365,
    y,
  );
  y -= 20;
  addText(commands, `Statut : ${formatInvoiceStatus(invoice.status)}`, 365, y);
  if (invoice.reason) {
    y -= 20;
    addText(commands, `Raison : ${invoice.reason.slice(0, 34)}`, 365, y);
  }
  pages.forEach((page, index) => {
    addText(page, `Page ${index + 1}/${pages.length}`, 490, 45, 9);
    addText(page, 'Merci pour votre confiance.', LEFT_MARGIN, 45, 10);
  });

  return buildPdfDocument(pages.map((page) => page.join('\n')));
}

function formatPaymentMethod(paymentMethod: string | null): string {
  const labels: Readonly<Record<string, string>> = {
    CASH: 'Espèces',
    MVOLA: 'MVola',
    AIRTEL_MONEY: 'Airtel Money',
    ORANGE_MONEY: 'Orange Money',
  };

  return paymentMethod ? (labels[paymentMethod] ?? paymentMethod) : 'Non payée';
}

function formatInvoiceStatus(status: string): string {
  const labels: Readonly<Record<string, string>> = {
    VALIDATED: 'Validée',
    PAID: 'Payée',
    REFUNDED: 'Remboursée',
    CANCELLED: 'Annulée',
  };

  return labels[status] ?? status;
}
