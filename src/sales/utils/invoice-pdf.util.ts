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
  address: string;
  nif: string;
  stat: string;
  slogan: string;
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
const INVOICE_LOGO_TOP = 32;
const INVOICE_LOGO_SIZE = 70;
const INVOICE_BRAND_TEXT_LEFT = 128;
const INVOICE_BRAND_TEXT_WIDTH = 180;
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
    CHECK: 'Chèque',
    BANK_TRANSFER: 'Virement bancaire',
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

function drawLogo(
  document: PDFKit.PDFDocument,
  logoPath: string,
  x: number,
  y: number,
  size: number,
): void {
  const resolvedLogoPath = resolve(logoPath);

  if (existsSync(resolvedLogoPath)) {
    try {
      document.image(resolvedLogoPath, x, y, {
        fit: [size, size],
        align: 'center',
        valign: 'center',
      });
      return;
    } catch {
      // Le logo de remplacement ci-dessous garantit une facture exploitable.
    }
  }

  document.roundedRect(x, y, size, size, 9).fill('#0f766e');
  document
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(Math.max(20, size * 0.48))
    .text('M', x, y + size * 0.28, { width: size, align: 'center' });
}

function drawTableHeader(document: PDFKit.PDFDocument, y: number): number {
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

function drawPageHeader(
  document: PDFKit.PDFDocument,
  invoice: InvoiceData,
  includeCustomer: boolean,
): number {
  if (includeCustomer) {
    drawLogo(
      document,
      invoice.company.logoPath,
      PAGE_MARGIN,
      INVOICE_LOGO_TOP,
      INVOICE_LOGO_SIZE,
    );
    document
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(17)
      .text('MA DISTRIBUTION', INVOICE_BRAND_TEXT_LEFT, 50, {
        width: INVOICE_BRAND_TEXT_WIDTH,
        align: 'center',
      });
    document
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#475569')
      .text(invoice.company.slogan, INVOICE_BRAND_TEXT_LEFT, 74, {
        width: INVOICE_BRAND_TEXT_WIDTH,
        align: 'center',
      });
    document
      .fillColor('#0f172a')
      .fontSize(9)
      .text(`Adresse : ${invoice.company.address}`, PAGE_MARGIN, 112, {
        width: 250,
      })
      .text(`NIF : ${invoice.company.nif}`, PAGE_MARGIN, 130, { width: 250 })
      .text(`STAT : ${invoice.company.stat}`, PAGE_MARGIN, 148, {
        width: 250,
      });

    document
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(`FACTURE N° ${invoice.saleId}`, 320, 38, {
        width: 227,
        align: 'right',
      });
    document.fontSize(10).text(`DOIT : ${invoice.customerName}`, 320, 68, {
      width: 227,
      height: 24,
      ellipsis: true,
    });
    document
      .font('Helvetica')
      .fontSize(9)
      .text(`NIF : ${invoice.customerNif || '-'}`, 320, 98, { width: 227 })
      .text(`STAT : ${invoice.customerStat || '-'}`, 320, 114, {
        width: 227,
      })
      .text(`Date : ${formatInvoiceDate(invoice.createdAt)}`, 320, 130, {
        width: 227,
      })
      .text(`Contact : ${invoice.customerContact || '-'}`, 320, 146, {
        width: 227,
      })
      .text(`Adresse : ${invoice.customerAddress || '-'}`, 320, 162, {
        width: 227,
        height: 24,
        ellipsis: true,
      });

    document.moveTo(PAGE_MARGIN, 194).lineTo(547, 194).stroke('#94a3b8');

    return drawTableHeader(document, 208);
  }

  drawLogo(document, invoice.company.logoPath, PAGE_MARGIN, 30, 46);
  document
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text('MA DISTRIBUTION', 104, 36, { width: 190 })
    .fontSize(12)
    .text(`FACTURE N° ${invoice.saleId} — suite`, 320, 38, {
      width: 227,
      align: 'right',
    });
  document.moveTo(PAGE_MARGIN, 88).lineTo(547, 88).stroke('#94a3b8');

  return drawTableHeader(document, 102);
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
      })
      .text(`Vendeur : ${invoice.sellerName}`, PAGE_MARGIN, y + 18, {
        width: 260,
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
        .text(
          `Merci pour votre confiance. — ${invoice.company.slogan}`,
          PAGE_MARGIN,
          770,
          { lineBreak: false },
        )
        .text(`Page ${index + 1}/${pageRange.count}`, 480, 770, {
          width: 67,
          align: 'right',
          lineBreak: false,
        });
    }

    document.end();
  });
}
