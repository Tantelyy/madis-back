import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';

export interface InvoiceLine {
  productName: string;
  quantity: number;
  freeQuantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface InvoiceCompany {
  nif: string;
  stat: string;
  logoPath: string;
}

export interface InvoiceData {
  saleId: number;
  createdAt: Date;
  customerName: string;
  customerContact: string | null;
  customerAddress: string | null;
  customerNif: string | null;
  customerStat: string | null;
  company: InvoiceCompany;
  sellerName: string;
  paymentMethod: string | null;
  status: string;
  reason: string | null;
  totalPrice: string;
  lines: InvoiceLine[];
}

const PAGE_MARGIN = 48;
const TABLE_COLUMNS = {
  product: PAGE_MARGIN,
  quantity: 350,
  unitPrice: 405,
  total: 490,
} as const;

function formatInvoiceDate(value: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Indian/Antananarivo',
  }).format(value);
}

function formatInvoiceAmount(value: string): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return value;
  }

  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/[\u00a0\u202f]/g, ' ');
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

function drawLogo(document: PDFKit.PDFDocument, logoPath: string): void {
  const resolvedLogoPath = resolve(logoPath);

  if (existsSync(resolvedLogoPath)) {
    try {
      document.image(resolvedLogoPath, PAGE_MARGIN, 38, {
        fit: [72, 52],
        valign: 'center',
      });
      return;
    } catch {
      // Le logo de remplacement ci-dessous garantit une facture exploitable.
    }
  }

  document.roundedRect(PAGE_MARGIN, 38, 52, 52, 9).fill('#0f766e');
  document
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(25)
    .text('M', PAGE_MARGIN, 51, { width: 52, align: 'center' });
}

function drawPageHeader(
  document: PDFKit.PDFDocument,
  invoice: InvoiceData,
  includeCustomer: boolean,
): number {
  drawLogo(document, invoice.company.logoPath);
  document
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(17)
    .text('MA DISTRIBUTION', 112, 42);
  document
    .font('Helvetica')
    .fontSize(9)
    .text(`NIF : ${invoice.company.nif}`, 112, 65)
    .text(`STAT : ${invoice.company.stat}`, 112, 78);
  document
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(`FACTURE N° ${invoice.saleId}`, 350, 44, {
      width: 197,
      align: 'right',
    });
  document
    .font('Helvetica')
    .fontSize(9)
    .text(formatInvoiceDate(invoice.createdAt), 330, 70, {
      width: 217,
      align: 'right',
    });

  let y = 112;
  if (includeCustomer) {
    document
      .roundedRect(PAGE_MARGIN, y, 499, 90, 6)
      .fillAndStroke('#f8fafc', '#e2e8f0');
    document
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(`Client : ${invoice.customerName}`, 60, y + 12);
    document
      .font('Helvetica')
      .fontSize(9)
      .text(`Contact : ${invoice.customerContact || '-'}`, 60, y + 32)
      .text(`Adresse : ${invoice.customerAddress || '-'}`, 60, y + 49)
      .text(`NIF : ${invoice.customerNif || '-'}`, 330, y + 32)
      .text(`STAT : ${invoice.customerStat || '-'}`, 330, y + 49);
    y += 112;
  }

  document
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Produit', TABLE_COLUMNS.product, y)
    .text('Qté', TABLE_COLUMNS.quantity, y)
    .text('P.U.', TABLE_COLUMNS.unitPrice, y)
    .text('Total', TABLE_COLUMNS.total, y);
  document
    .moveTo(PAGE_MARGIN, y + 15)
    .lineTo(547, y + 15)
    .stroke('#cbd5e1');

  return y + 26;
}

export function generateInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  return new Promise<Buffer>((resolvePdf, rejectPdf) => {
    const document = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      bufferPages: true,
      compress: false,
      info: { Title: `Facture ${invoice.saleId}` },
    });
    const chunks: Buffer[] = [];
    let y = drawPageHeader(document, invoice, true);

    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', rejectPdf);
    document.on('end', () => resolvePdf(Buffer.concat(chunks)));

    invoice.lines.forEach((line) => {
      const lineHeight = line.freeQuantity > 0 ? 34 : 19;
      if (y + lineHeight > 705) {
        document.addPage();
        y = drawPageHeader(document, invoice, false);
      }

      document
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(9)
        .text(line.productName, TABLE_COLUMNS.product, y, { width: 285 })
        .text(String(line.quantity), TABLE_COLUMNS.quantity, y, { width: 40 })
        .text(
          `${formatInvoiceAmount(line.unitPrice)} Ar`,
          TABLE_COLUMNS.unitPrice,
          y,
          {
            width: 75,
            align: 'right',
          },
        )
        .text(
          `${formatInvoiceAmount(line.totalPrice)} Ar`,
          TABLE_COLUMNS.total,
          y,
          {
            width: 57,
            align: 'right',
          },
        );
      if (line.freeQuantity > 0) {
        document
          .fillColor('#0f766e')
          .fontSize(8)
          .text(
            `+ ${line.freeQuantity} offert(s)`,
            TABLE_COLUMNS.product + 10,
            y + 15,
          );
      }
      y += lineHeight;
    });

    if (y > 655) {
      document.addPage();
      y = drawPageHeader(document, invoice, false);
    }

    document
      .moveTo(PAGE_MARGIN, y + 4)
      .lineTo(547, y + 4)
      .stroke('#94a3b8');
    document
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(
        `TOTAL : ${formatInvoiceAmount(invoice.totalPrice)} Ar`,
        350,
        y + 18,
        {
          width: 197,
          align: 'right',
        },
      );
    document
      .font('Helvetica')
      .fontSize(9)
      .text(
        `Paiement : ${formatPaymentMethod(invoice.paymentMethod)}`,
        350,
        y + 43,
        {
          width: 197,
          align: 'right',
        },
      )
      .text(`Statut : ${formatInvoiceStatus(invoice.status)}`, 350, y + 58, {
        width: 197,
        align: 'right',
      });
    if (invoice.reason) {
      document.text(`Raison : ${invoice.reason}`, 350, y + 73, {
        width: 197,
        align: 'right',
      });
    }

    const pageRange = document.bufferedPageRange();
    for (let index = 0; index < pageRange.count; index += 1) {
      document.switchToPage(index);
      document
        .fillColor('#64748b')
        .font('Helvetica')
        .fontSize(8)
        .text('Merci pour votre confiance.', PAGE_MARGIN, 770, {
          lineBreak: false,
        })
        .text(`Page ${index + 1}/${pageRange.count}`, 480, 770, {
          width: 67,
          align: 'right',
          lineBreak: false,
        });
    }

    document.end();
  });
}
