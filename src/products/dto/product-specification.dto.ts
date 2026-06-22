import { IsNotEmpty, IsString } from 'class-validator';

export class ProductSpecificationDto {
  @IsString()
  @IsNotEmpty({ message: 'La spécification est requise' })
  specification!: string;
}
