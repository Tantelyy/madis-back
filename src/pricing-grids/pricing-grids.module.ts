import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PricingGridsController } from './pricing-grids.controller';
import { PricingGridsService } from './pricing-grids.service';

@Module({
  imports: [AuthModule],
  controllers: [PricingGridsController],
  providers: [PricingGridsService],
})
export class PricingGridsModule {}
