import { PaymentMethod } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class PaySaleDto {
  @IsEnum(PaymentMethod, { message: 'Le mode de paiement est invalide.' })
  paymentMethod!: PaymentMethod;
}
