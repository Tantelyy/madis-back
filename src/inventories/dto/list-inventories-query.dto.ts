import { Transform, TransformFnParams } from 'class-transformer';
import { InventoryMovementType } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const INVENTORY_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'quantity',
  'remainingQuantity',
  'purchasePrice',
  'salePrice',
  'wholesalePrice',
  'expiredAt',
] as const;
export const INVENTORY_SORT_ORDERS = ['asc', 'desc'] as const;

export type InventorySortField = (typeof INVENTORY_SORT_FIELDS)[number];
export type InventorySortOrder = (typeof INVENTORY_SORT_ORDERS)[number];

export class ListInventoriesQueryDto {
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

  @IsIn(INVENTORY_SORT_FIELDS)
  @IsOptional()
  sortBy: InventorySortField = 'createdAt';

  @IsIn(INVENTORY_SORT_ORDERS)
  @IsOptional()
  order: InventorySortOrder = 'desc';
}

export class ListInventoryMovementsQueryDto {
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

  @IsEnum(InventoryMovementType)
  @IsOptional()
  type?: InventoryMovementType;

  @Transform(({ value }: TransformFnParams) => Number(value))
  @IsInt()
  @Min(1)
  @IsOptional()
  inventoryId?: number;
}
