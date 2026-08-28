import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { ProfitabilityQueryDto } from './dto/profitability-query.dto';
import { SalesStockQueryDto } from './dto/sales-stock-query.dto';
import type { ForecastItem } from './interfaces/forecast.interface';
import type { ProfitabilityStatistics } from './interfaces/profitability.interface';
import type { SalesStockAnalysis } from './interfaces/sales-stock.interface';
import type { StockFinancialValue } from './interfaces/stock-value.interface';

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

  @Get('forecasts/:productId')
  getProductForecast(
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<ForecastItem> {
    return this.dashboardService.getProductForecast(productId);
  }

  @Get('stock-value')
  getStockFinancialValue(): Promise<StockFinancialValue> {
    return this.dashboardService.getStockFinancialValue();
  }
}
