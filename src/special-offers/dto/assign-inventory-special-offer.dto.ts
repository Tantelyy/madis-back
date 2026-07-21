import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class AssignInventorySpecialOfferDto {
  @Type(() => Number)
  @IsInt({ message: 'La ligne de stock est invalide.' })
  @Min(1, { message: 'La ligne de stock est invalide.' })
  inventoryId!: number;

  @IsDateString({}, { message: 'La date limite est invalide.' })
  @IsOptional()
  limitDate?: string;
}
