import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { ProfitabilityQueryDto } from './dto/profitability-query.dto';
import { SalesStockQueryDto } from './dto/sales-stock-query.dto';
import type { ProfitabilityStatistics } from './interfaces/profitability.interface';
import type { SalesStockAnalysis } from './interfaces/sales-stock.interface';

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

  @Get('sales-stock')
  getSalesStockAnalysis(
    @Query() query: SalesStockQueryDto,
  ): Promise<SalesStockAnalysis> {
    return this.dashboardService.getSalesStockAnalysis(query);
  }
}
