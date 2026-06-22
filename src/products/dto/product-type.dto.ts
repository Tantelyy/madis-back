import { IsNotEmpty, IsString } from 'class-validator';

export class ProductTypeDto {
  @IsString()
  @IsNotEmpty({ message: 'Le type de produit est requis' })
  type!: string;
}
