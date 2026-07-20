import { CartStatus, PaymentMethod } from '@prisma/client';
import type { CartDetailEntity } from './cart-detail.entity';

export class CartUserEntity {
  id!: number;
  userName!: string;
  email!: string;
}

export class CartEntity {
  id!: number;
  soldBy!: number;
  createdAt!: Date;
  updatedAt!: Date;
  status!: CartStatus;
  validatedBy!: number | null;
  totalPrice!: string;
  customerName!: string;
  customerContact!: string;
  customerAddress!: string;
  paymentMethod!: PaymentMethod;
  seller?: CartUserEntity;
  validator?: CartUserEntity | null;
  cartDetails?: CartDetailEntity[];
}
