import 'reflect-metadata';
import { PaymentMethod } from '@prisma/client';
import { validate } from 'class-validator';
import { CreateSaleDto, CreateSaleItemDto } from './create-sale.dto';

function createSaleDto(
  paymentMethod: PaymentMethod | null = PaymentMethod.CASH,
): CreateSaleDto {
  const item = new CreateSaleItemDto();
  item.productId = 1;
  item.quantity = 2;
  item.wholesale = false;

  const dto = new CreateSaleDto();
  dto.customerName = 'Client test';
  dto.customerContact = '0340000000';
  dto.customerAddress = 'Antananarivo';
  if (paymentMethod !== null) {
    dto.paymentMethod = paymentMethod;
  }
  dto.items = [item];

  return dto;
}

describe('CreateSaleDto', () => {
  it('accepte un moyen de paiement valide', async () => {
    const errors = await validate(createSaleDto());

    expect(errors).toHaveLength(0);
  });

  it('refuse une vente sans moyen de paiement', async () => {
    const errors = await validate(createSaleDto(null));

    expect(errors.some((error) => error.property === 'paymentMethod')).toBe(
      true,
    );
  });
});
