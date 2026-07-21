import { Transform, TransformFnParams } from 'class-transformer';
import { SpecialOfferType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListSpecialOffersQueryDto {
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

  @IsEnum(SpecialOfferType)
  @IsOptional()
  type?: SpecialOfferType;
}
