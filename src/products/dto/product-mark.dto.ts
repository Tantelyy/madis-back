import { IsNotEmpty, IsString } from 'class-validator';

export class ProductMarkDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la marque est requis' })
  name!: string;
}
