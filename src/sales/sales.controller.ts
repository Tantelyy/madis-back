import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SALES_ACCESS_REQUIREMENTS } from '../auth/constants/sales-access.constants';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CartEntity } from '../carts/entities/cart.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { ListSaleCatalogQueryDto } from './dto/list-sale-catalog-query.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { PaySaleDto } from './dto/pay-sale.dto';
import { SaleReversalDto } from './dto/sale-reversal.dto';
import { PaginatedSales } from './interfaces/paginated-sales.interface';
import { PaginatedSaleCatalog } from './interfaces/paginated-sale-catalog.interface';
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
    return this.salesService.create(dto, user);
  }

  @Get('catalog')
  findCatalog(
    @Query() query: ListSaleCatalogQueryDto,
  ): Promise<PaginatedSaleCatalog> {
    return this.salesService.findCatalog(query);
  }

  @Get()
  findAll(
    @Query() query: ListSalesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedSales> {
    return this.salesService.findAll(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.salesService.findOne(id, user);
  }

  @Post(':id/pay')
  pay(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PaySaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.salesService.pay(id, dto.paymentMethod, user);
  }

  @Post(':id/validate')
  @RequireAccess({ roles: ['ADMIN'], permissions: ['ALL'] })
  validate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.salesService.validate(id, user);
  }

  @Post(':id/invoice')
  async generateInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const invoice = await this.salesService.generateInvoice(id, dto, user);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="facture-${id}.pdf"`,
    );
    response.send(invoice);
  }

  @Post(':id/refund')
  refund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaleReversalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.salesService.refund(id, dto.reason, user);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaleReversalDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CartEntity> {
    return this.salesService.cancel(id, dto.reason, user);
  }
}
