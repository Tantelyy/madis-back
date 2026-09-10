import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';
import { PricingRuleInputDto } from './pricing-rule-input.dto';

export class UpdatePricingGridDto {
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PricingRuleInputDto)
  pricingRules!: PricingRuleInputDto[];
}
