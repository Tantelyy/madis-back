import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaleReversalDto } from './sale-reversal.dto';

describe('SaleReversalDto', () => {
  it('rejects a reason containing only spaces', async () => {
    const dto = plainToInstance(SaleReversalDto, { reason: '   ' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      'La raison est obligatoire.',
    );
  });

  it('trims a valid reason', async () => {
    const dto = plainToInstance(SaleReversalDto, {
      reason: '  Produit retourne  ',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason.trim()).toBe('Produit retourne');
  });
});
