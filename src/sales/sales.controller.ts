import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SALES_ACCESS_REQUIREMENTS } from '../auth/constants/sales-access.constants';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CartEntity } from '../carts/entities/cart.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { PaySaleDto } from './dto/pay-sale.dto';
import { SaleReversalDto } from './dto/sale-reversal.dto';
import { PaginatedSales } from './interfaces/paginated-sales.interface';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireAccess(SALES_ACCESS_REQUIREMENTS)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.salesService.create(dto, user.id);
  }

  @Get()
  findAll(@Query() query: ListSalesQueryDto): Promise<PaginatedSales> {
    return this.salesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CartEntity> {
    return this.salesService.findOne(id);
  }

  @Post(':id/pay')
  pay(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PaySaleDto,
  ): Promise<CartEntity> {
    return this.salesService.pay(id, dto.paymentMethod);
  }

  @Post(':id/refund')
  refund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaleReversalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.salesService.refund(id, dto.reason, user.id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaleReversalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.salesService.cancel(id, dto.reason, user.id);
  }
}
