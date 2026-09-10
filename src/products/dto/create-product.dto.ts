import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'La référence du produit est requise' })
  reference!: string;

  @IsInt({ message: 'La marque du produit est invalide' })
  @Min(1, { message: 'La marque du produit est invalide' })
  markId!: number;

  @IsInt({ message: 'La spécification du produit est invalide' })
  @Min(1, { message: 'La spécification du produit est invalide' })
  specificationId!: number;

  @IsInt({ message: 'Le format du produit est invalide' })
  @Min(1, { message: 'Le format du produit est invalide' })
  formatId!: number;

  @IsInt({ message: 'Le type du produit est invalide' })
  @Min(1, { message: 'Le type du produit est invalide' })
  productTypeId!: number;

  @IsString()
  @IsOptional()
  image?: string;
}
