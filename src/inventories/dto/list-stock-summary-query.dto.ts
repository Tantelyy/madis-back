import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const STOCK_SUMMARY_SORT_FIELDS = [
  'name',
  'reference',
  'remainingQuantity',
] as const;

export const STOCK_SUMMARY_SORT_ORDERS = ['asc', 'desc'] as const;

export type StockSummarySortField = (typeof STOCK_SUMMARY_SORT_FIELDS)[number];
export type StockSummarySortOrder = (typeof STOCK_SUMMARY_SORT_ORDERS)[number];

export class ListStockSummaryQueryDto {
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

  @IsString()
  @IsOptional()
  search?: string;

  @IsDateString({}, { message: "La date d'expiration est invalide." })
  @IsOptional()
  expiresBefore?: string;

  @IsIn(STOCK_SUMMARY_SORT_FIELDS)
  @IsOptional()
  sortBy: StockSummarySortField = 'name';

  @IsIn(STOCK_SUMMARY_SORT_ORDERS)
  @IsOptional()
  order: StockSummarySortOrder = 'asc';
}
