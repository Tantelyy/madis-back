import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'La référence du produit ne peut pas être vide' })
  @IsOptional()
  reference?: string;

  @IsInt({ message: 'La marque du produit est invalide' })
  @Min(1, { message: 'La marque du produit est invalide' })
  @IsOptional()
  markId?: number;

  @IsInt({ message: 'La spécification du produit est invalide' })
  @Min(1, { message: 'La spécification du produit est invalide' })
  @IsOptional()
  specificationId?: number;

  @IsInt({ message: 'Le format du produit est invalide' })
  @Min(1, { message: 'Le format du produit est invalide' })
  @IsOptional()
  formatId?: number;

  @IsInt({ message: 'Le type du produit est invalide' })
  @Min(1, { message: 'Le type du produit est invalide' })
  @IsOptional()
  productTypeId?: number;

  @IsString()
  @IsOptional()
  image?: string;
}
