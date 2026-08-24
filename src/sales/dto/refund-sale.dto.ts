import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class RefundSaleItemDto {
  @Type(() => Number)
  @IsInt({ message: 'La ligne de vente est invalide.' })
  @Min(1, { message: 'La ligne de vente est invalide.' })
  cartDetailId!: number;

  @Type(() => Number)
  @IsInt({ message: 'La quantité remboursée est invalide.' })
  @Min(1, { message: 'La quantité remboursée doit être supérieure à 0.' })
  quantity!: number;

  @IsString()
  @IsNotEmpty({ message: 'La raison du remboursement est obligatoire.' })
  @Matches(/\S/, { message: 'La raison du remboursement est obligatoire.' })
  reason!: string;
}

export class RefundSaleDto {
  @IsArray({ message: 'Les produits à rembourser sont invalides.' })
  @ArrayMinSize(1, { message: 'Sélectionnez au moins un produit.' })
  @ArrayUnique((item: RefundSaleItemDto) => item.cartDetailId, {
    message: 'Un produit ne peut être remboursé qu’une fois par demande.',
  })
  @ValidateNested({ each: true })
  @Type(() => RefundSaleItemDto)
  items!: RefundSaleItemDto[];
}
