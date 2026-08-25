import { CartStatus, PaymentMethod, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';

const saleDate = new Date('2026-08-25T10:00:00.000Z');
const inventory = {
  id: 12,
  productId: 4,
  remainingQuantity: 5,
  expiredAt: null,
  createdAt: saleDate,
  purchasePrice: new Prisma.Decimal(100),
  salePrice: new Prisma.Decimal(150),
  wholesalePrice: new Prisma.Decimal(130),
};

function salePayload(status: CartStatus) {
  return {
    id: 8,
    soldBy: 3,
    createdAt: saleDate,
    updatedAt: saleDate,
    status,
    validatedBy: 3,
    validatedAt: saleDate,
    paidAt: status === CartStatus.PAID ? saleDate : null,
    totalPrice: new Prisma.Decimal(300),
    customerName: null,
    customerContact: null,
    customerAddress: null,
    customerNif: null,
    customerStat: null,
    paymentMethod: status === CartStatus.PAID ? PaymentMethod.CASH : null,
    reason: null,
    seller: { id: 3, userName: 'Vendeur', email: 'vendeur@test.mg' },
    validator: { id: 3, userName: 'Vendeur', email: 'vendeur@test.mg' },
    cartDetails: [
      {
        id: 20,
        cartId: 8,
        inventoryId: 12,
        quantity: 2,
        freeQuantity: null,
        baseUnitPrice: new Prisma.Decimal(150),
        finalUnitPrice: new Prisma.Decimal(150),
        discountAmount: null,
        wholesale: false,
        specialOfferId: null,
        refundAt: null,
        refundBy: null,
        refundedQuantity: 0,
        reason: null,
        inventory: { ...inventory, product: { id: 4, name: 'Produit', reference: 'REF-4', image: null } },
        refundUser: null,
      },
    ],
    inventoryMovements: [],
  };
}

describe('SalesService stock flow', () => {
  const user = {
    id: 3,
    email: 'vendeur@test.mg',
    role: 'SELLER',
    permissions: [],
  };

  it('creates a validated sale without decrementing stock', async () => {
    const cartCreate = jest.fn().mockResolvedValue({ id: 8 });
    const tx = {
      product: { findMany: jest.fn().mockResolvedValue([{ id: 4, name: 'Produit' }]) },
      inventory: {
        findMany: jest.fn().mockResolvedValue([{ ...inventory, inventorySpecialOffers: [] }]),
        updateMany: jest.fn(),
      },
      cart: { create: cartCreate, findUnique: jest.fn().mockResolvedValue(salePayload(CartStatus.VALIDATED)) },
      inventoryMovement: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new SalesService(prisma, {} as ConfigService);

    await service.create({ items: [{ productId: 4, quantity: 2, wholesale: false }] }, user);

    expect(cartCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CartStatus.VALIDATED,
          validatedAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('decrements stock and creates the SALE movement only when payment is confirmed', async () => {
    const stockUpdate = jest.fn().mockResolvedValue({ count: 1 });
    const movementCreate = jest.fn().mockResolvedValue({ id: 9 });
    const tx = {
      cart: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(salePayload(CartStatus.PAID)),
      },
      cartDetail: {
        findMany: jest.fn().mockResolvedValue([
          { inventoryId: 12, quantity: 2, freeQuantity: null, inventory },
        ]),
      },
      inventory: { updateMany: stockUpdate, findUnique: jest.fn() },
      inventoryMovement: { create: movementCreate },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new SalesService(prisma, {} as ConfigService);

    await service.pay(8, PaymentMethod.CASH, user);

    expect(tx.cart.updateMany).toHaveBeenCalledWith({
      where: { id: 8, status: CartStatus.VALIDATED, soldBy: 3 },
      data: {
        status: CartStatus.PAID,
        paymentMethod: PaymentMethod.CASH,
        paidAt: expect.any(Date),
      },
    });
    expect(stockUpdate).toHaveBeenCalledWith({
      where: { id: 12, remainingQuantity: { gte: 2 } },
      data: { remainingQuantity: { decrement: 2 } },
    });
    expect(movementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inventoryId: 12,
          outgoingQuantity: 2,
          type: 'SALE',
          cartId: 8,
        }),
      }),
    );
  });

  it('refuses a second refund once a sale is partially refunded', async () => {
    const tx = {
      cart: {
        findFirst: jest.fn().mockResolvedValue({
          status: CartStatus.PARTIALLY_REFUNDED,
        }),
      },
      cartDetail: { update: jest.fn() },
      inventoryMovement: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new SalesService(prisma, {} as ConfigService);

    await expect(
      service.refund(
        8,
        {
          items: [
            { cartDetailId: 20, quantity: 1, reason: 'Retour client' },
          ],
        },
        user,
      ),
    ).rejects.toThrow('PARTIALLY_REFUNDED');
    expect(tx.cartDetail.update).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('records a free promotion product separately from a paid sale', async () => {
    const movementCreate = jest.fn().mockResolvedValue({ id: 9 });
    const tx = {
      cart: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(salePayload(CartStatus.PAID)),
      },
      cartDetail: {
        findMany: jest.fn().mockResolvedValue([
          {
            inventoryId: 12,
            quantity: 0,
            freeQuantity: 1,
            specialOfferId: 5,
            inventory,
          },
        ]),
      },
      inventory: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      inventoryMovement: { create: movementCreate },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new SalesService(prisma, {} as ConfigService);

    await service.pay(8, PaymentMethod.CASH, user);

    expect(movementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outgoingQuantity: 1,
          type: 'PROMOTION_GIFT',
        }),
      }),
    );
  });
});
