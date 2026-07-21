import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateSaleItemDto {
  @Type(() => Number)
  @IsInt({ message: 'La ligne de stock est invalide.' })
  @Min(1, { message: 'La ligne de stock est invalide.' })
  inventoryId!: number;

  @Type(() => Number)
  @IsInt({ message: 'La quantite est invalide.' })
  @Min(1, { message: 'La quantite doit etre superieure a 0.' })
  quantity!: number;

  @IsBoolean({ message: 'Le type de prix est invalide.' })
  @IsOptional()
  wholesale: boolean = false;
}

export class CreateSaleDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du client est obligatoire.' })
  @Matches(/\S/, { message: 'Le nom du client est obligatoire.' })
  customerName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le contact du client est obligatoire.' })
  @Matches(/\S/, { message: 'Le contact du client est obligatoire.' })
  customerContact!: string;

  @IsString()
  @IsNotEmpty({ message: "L'adresse du client est obligatoire." })
  @Matches(/\S/, { message: "L'adresse du client est obligatoire." })
  customerAddress!: string;

  @IsArray({ message: 'Les produits de la vente sont invalides.' })
  @ArrayMinSize(1, { message: 'La vente doit contenir au moins un produit.' })
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}
