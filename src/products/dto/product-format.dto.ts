import { IsNotEmpty, IsString } from 'class-validator';

export class ProductFormatDto {
  @IsString()
  @IsNotEmpty({ message: 'Le format est requis' })
  format!: string;
}
