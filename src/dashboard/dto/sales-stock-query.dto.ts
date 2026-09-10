import { Transform, type TransformFnParams } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DashboardPeriodQueryDto } from './dashboard-period-query.dto';

export class SalesStockQueryDto extends DashboardPeriodQueryDto {
  @Transform(({ value }: TransformFnParams) => Number(value))
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Transform(({ value }: TransformFnParams) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 10;

  @Transform(({ value }: TransformFnParams) => Number(value))
  @IsInt({ message: 'Le type de produit est invalide.' })
  @Min(1, { message: 'Le type de produit est invalide.' })
  @IsOptional()
  productTypeId?: number;
}
