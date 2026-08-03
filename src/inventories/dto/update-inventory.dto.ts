import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateInventoryDto {
  @Type(() => Number)
  @IsInt({ message: 'Le produit est invalide' })
  @Min(1, { message: 'Le produit est invalide' })
  @IsOptional()
  productId?: number;

  @Type(() => Number)
  @IsInt({ message: 'La quantité est invalide' })
  @Min(0, { message: 'La quantité doit être positive' })
  @IsOptional()
  quantity?: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Le prix d'achat est invalide" },
  )
  @Min(0, { message: "Le prix d'achat doit être positif" })
  @IsOptional()
  purchasePrice?: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le prix de vente est invalide' },
  )
  @Min(0, { message: 'Le prix de vente doit être positif' })
  @IsOptional()
  salePrice?: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Le prix de vente en gros est invalide' },
  )
  @Min(0, { message: 'Le prix de vente en gros doit être positif' })
  @IsOptional()
  wholesalePrice?: number;

  @Type(() => Number)
  @IsInt({ message: 'Le fournisseur est invalide' })
  @Min(1, { message: 'Le fournisseur est invalide' })
  @IsOptional()
  supplierId?: number;

  @IsDateString({}, { message: "La date d'expiration est invalide" })
  @IsOptional()
  expiredAt?: string | null;
}
