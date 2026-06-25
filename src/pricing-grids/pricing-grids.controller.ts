import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PricingGridEntity } from './entities/pricing-grid.entity';
import { PricingGridsService } from './pricing-grids.service';

@Controller('pricing-grids')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireAccess({
  roles: ['ADMIN'],
  permissions: ['CAN_PRODUCTS', 'ALL'],
})
export class PricingGridsController {
  constructor(private readonly pricingGridsService: PricingGridsService) {}

  @Get('active')
  findActive(): Promise<PricingGridEntity> {
    return this.pricingGridsService.findActive();
  }
}
