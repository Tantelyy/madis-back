import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class PricingRuleInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPurchasePrice!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPurchasePrice!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  retailMarginPercent!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  wholesaleMarginPercent!: number;
}
