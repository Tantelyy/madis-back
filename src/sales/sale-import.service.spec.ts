import {
  CartStatus,
  InventoryMovementType,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SaleImportSummary } from './interfaces/sale-import.interface';
import { SaleImportService } from './sale-import.service';

describe('SaleImportService', () => {
  it('creates one paid cart per matched sold row and skips exhausted lots', async () => {
    const inventoryDate = new Date('2026-04-23T00:00:00.000Z');
    const saleDate = new Date('2026-04-24T10:11:12.000Z');
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 12,
        createdAt: inventoryDate,
        remainingQuantity: 1,
        purchasePrice: new Prisma.Decimal(100),
        salePrice: new Prisma.Decimal(140),
        wholesalePrice: new Prisma.Decimal(130),
        product: { reference: 'REF-1' },
        supplier: { name: 'Fournisseur' },
      },
    ]);
    const cartCreate = jest.fn().mockResolvedValue({ id: 8 });
    const movementCreate = jest.fn().mockResolvedValue({ id: 4 });
    const tx = {
      inventory: {
        findMany,
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cart: { create: cartCreate },
      inventoryMovement: { create: movementCreate },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: jest.fn(
        (
          callback: (
            transaction: Prisma.TransactionClient,
          ) => Promise<SaleImportSummary>,
        ) => callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new SaleImportService(prisma);
    const csv = [
      'Date,Réf MADIS,Statut,Réf Stat,Fournisseur,Prix Gros,Détail,Gros',
      '23/4/2026,REF-1,Vendu,24/4/2026 10:11:12,Fournisseur,135,145,FALSE',
      '23/4/2026,REF-1,Vendu,24/4/2026 10:12:12,Fournisseur,135,145,FALSE',
      '23/4/2026,REF-1,Disponible,24/4/2026 10:13:12,Fournisseur,135,145,FALSE',
    ].join('\n');

    const summary = await service.importCsv(
      {
        originalname: 'ventes.csv',
        mimetype: 'text/csv',
        size: Buffer.byteLength(csv),
        buffer: Buffer.from(csv),
      },
      3,
    );

    expect(summary).toEqual({
      rowsProcessed: 3,
      rowsNotSold: 1,
      rowsWithoutInventory: 1,
      salesCreated: 1,
      movementsCreated: 1,
    });
    expect(cartCreate).toHaveBeenCalledTimes(1);
    expect(cartCreate).toHaveBeenCalledWith({
      data: {
        soldBy: 3,
        validatedBy: 3,
        createdAt: saleDate,
        status: CartStatus.PAID,
        paymentMethod: PaymentMethod.CASH,
        totalPrice: '145.00',
        cartDetails: {
          create: {
            inventoryId: 12,
            quantity: 1,
            freeQuantity: null,
            wholesale: false,
            baseUnitPrice: '145.00',
            finalUnitPrice: '145.00',
            discountAmount: null,
            specialOfferId: null,
          },
        },
      },
      select: { id: true },
    });
    expect(movementCreate).toHaveBeenCalledWith({
      data: {
        inventoryId: 12,
        incomingQuantity: 0,
        outgoingQuantity: 1,
        actorId: 3,
        type: InventoryMovementType.SALE,
        purchasePrice: new Prisma.Decimal(100),
        salePrice: new Prisma.Decimal(140),
        wholesalePrice: new Prisma.Decimal(130),
        cartId: 8,
        createdAt: saleDate,
      },
    });
  });
});
