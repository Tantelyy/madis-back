import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { ProfitabilityQueryDto } from './dto/profitability-query.dto';
import type { ProfitabilityStatistics } from './interfaces/profitability.interface';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireAccess({ roles: ['ADMIN'], permissions: ['ALL'] })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('profitability')
  getProfitability(
    @Query() query: ProfitabilityQueryDto,
  ): Promise<ProfitabilityStatistics> {
    return this.dashboardService.getProfitability(query);
  }
}
