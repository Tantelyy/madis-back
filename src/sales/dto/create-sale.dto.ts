import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateSaleItemDto {
  @Type(() => Number)
  @IsInt({ message: 'Le produit est invalide.' })
  @Min(1, { message: 'Le produit est invalide.' })
  productId!: number;

  @Type(() => Number)
  @IsInt({ message: 'La quantité est invalide.' })
  @Min(1, { message: 'La quantité doit être supérieure à 0.' })
  quantity!: number;

  @IsBoolean({ message: 'Le type de prix est invalide.' })
  @IsOptional()
  wholesale: boolean = false;
}

export class CreateSaleDto {
  @IsString()
  @IsOptional()
  @Matches(/\S/, { message: 'Le nom du client est obligatoire.' })
  customerName?: string;

  @IsString()
  @IsOptional()
  customerContact?: string;

  @IsString()
  @IsOptional()
  customerAddress?: string;

  @IsString()
  @IsOptional()
  customerNif?: string;

  @IsString()
  @IsOptional()
  customerStat?: string;

  @IsEnum(PaymentMethod, { message: 'Le mode de paiement est invalide.' })
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsArray({ message: 'Les produits de la vente sont invalides.' })
  @ArrayMinSize(1, { message: 'La vente doit contenir au moins un produit.' })
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}
