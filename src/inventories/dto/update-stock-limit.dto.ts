import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateStockLimitDto {
  @Type(() => Number)
  @IsInt({ message: 'Le seuil doit être un nombre entier.' })
  @Min(0, { message: 'Le seuil ne peut pas être négatif.' })
  value!: number;
}
