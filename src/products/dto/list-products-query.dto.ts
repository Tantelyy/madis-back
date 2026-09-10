import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const PRODUCT_SORT_FIELDS = [
  'name',
  'reference',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const;
export const PRODUCT_SORT_ORDERS = ['asc', 'desc'] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];
export type ProductSortOrder = (typeof PRODUCT_SORT_ORDERS)[number];

export class ListProductsQueryDto {
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

  @IsIn(PRODUCT_SORT_FIELDS)
  @IsOptional()
  sortBy: ProductSortField = 'createdAt';

  @IsIn(PRODUCT_SORT_ORDERS)
  @IsOptional()
  order: ProductSortOrder = 'desc';
}
