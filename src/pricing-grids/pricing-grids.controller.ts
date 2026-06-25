import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdatePricingGridDto } from './dto/update-pricing-grid.dto';
import { PricingGridEntity } from './entities/pricing-grid.entity';
import { PricingGridsService } from './pricing-grids.service';

@Controller('pricing-grids')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireAccess({
  roles: ['ADMIN'],
  permissions: ['CAN_MARGE', 'ALL'],
})
export class PricingGridsController {
  constructor(private readonly pricingGridsService: PricingGridsService) {}

  @Get('active')
  findActive(): Promise<PricingGridEntity> {
    return this.pricingGridsService.findActive();
  }

  @Post()
  updateActive(
    @Body() dto: UpdatePricingGridDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PricingGridEntity> {
    return this.pricingGridsService.updateActive(dto, user.id);
  }
}
