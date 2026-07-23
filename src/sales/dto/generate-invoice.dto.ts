import { IsOptional, IsString, Matches } from 'class-validator';

export class GenerateInvoiceDto {
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
}
