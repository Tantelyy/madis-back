import { Transform, TransformFnParams } from 'class-transformer';
import { CartStatus, PaymentMethod } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

export class ListSalesQueryDto extends DateRangeQueryDto {
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

  @IsEnum(CartStatus)
  @IsOptional()
  status?: CartStatus;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @Transform(({ value }: TransformFnParams) => value === 'true')
  @IsBoolean()
  @IsOptional()
  approvalQueue?: boolean;
}
