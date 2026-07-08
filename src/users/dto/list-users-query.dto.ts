import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const USER_SORT_FIELDS = ['userName', 'email', 'createdAt', 'updatedAt'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_ORDERS)[number];

export class ListUsersQueryDto {
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

  @IsIn(USER_SORT_FIELDS)
  @IsOptional()
  sortBy: UserSortField = 'createdAt';

  @IsIn(SORT_ORDERS)
  @IsOptional()
  order: SortOrder = 'desc';
}
