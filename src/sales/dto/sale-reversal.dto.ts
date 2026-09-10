import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SaleReversalDto {
  @IsString()
  @IsNotEmpty({ message: 'La raison est obligatoire.' })
  @Matches(/\S/, { message: 'La raison est obligatoire.' })
  reason!: string;
}
