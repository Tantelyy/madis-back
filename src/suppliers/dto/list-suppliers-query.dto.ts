import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const SUPPLIER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SupplierSortField = (typeof SUPPLIER_SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_ORDERS)[number];

export class ListSuppliersQueryDto {
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

  @IsIn(SUPPLIER_SORT_FIELDS)
  @IsOptional()
  sortBy: SupplierSortField = 'createdAt';

  @IsIn(SORT_ORDERS)
  @IsOptional()
  order: SortOrder = 'desc';
}
