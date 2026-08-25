import 'reflect-metadata';
import { SpecialOfferType, SpecialOfferUnit } from '@prisma/client';
import { validate } from 'class-validator';
import { CreateSpecialOfferDto } from './create-special-offer.dto';

describe('CreateSpecialOfferDto', () => {
  it('accepts several products for the same promotion', async () => {
    const dto = new CreateSpecialOfferDto();
    dto.productIds = [1, 2];
    dto.label = 'Promotion groupée';
    dto.startDateTime = '2026-08-25T08:00:00.000Z';
    dto.endDateTime = '2026-08-26T08:00:00.000Z';
    dto.type = SpecialOfferType.REDUCTION;
    dto.value = 10;
    dto.unit = SpecialOfferUnit.PERCENT;

    expect(await validate(dto)).toHaveLength(0);
  });
});
