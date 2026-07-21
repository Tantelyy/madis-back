import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SALES_ACCESS_REQUIREMENTS } from '../auth/constants/sales-access.constants';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AssignInventorySpecialOfferDto } from './dto/assign-inventory-special-offer.dto';
import { CreateSpecialOfferDto } from './dto/create-special-offer.dto';
import { ListSpecialOffersQueryDto } from './dto/list-special-offers-query.dto';
import { UpdateSpecialOfferDto } from './dto/update-special-offer.dto';
import { InventorySpecialOfferEntity } from './entities/inventory-special-offer.entity';
import { SpecialOfferEntity } from './entities/special-offer.entity';
import { PaginatedSpecialOffers } from './interfaces/paginated-special-offers.interface';
import { SpecialOffersService } from './special-offers.service';

@Controller('special-offers')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireAccess(SALES_ACCESS_REQUIREMENTS)
export class SpecialOffersController {
  constructor(private readonly specialOffersService: SpecialOffersService) {}

  @Post()
  create(
    @Body() dto: CreateSpecialOfferDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SpecialOfferEntity> {
    return this.specialOffersService.create(dto, user.id);
  }

  @Get()
  findAll(
    @Query() query: ListSpecialOffersQueryDto,
  ): Promise<PaginatedSpecialOffers> {
    return this.specialOffersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<SpecialOfferEntity> {
    return this.specialOffersService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSpecialOfferDto,
  ): Promise<SpecialOfferEntity> {
    return this.specialOffersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.specialOffersService.remove(id, user.id);
  }

  @Post(':id/inventories')
  assignInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignInventorySpecialOfferDto,
  ): Promise<InventorySpecialOfferEntity> {
    return this.specialOffersService.assignInventory(id, dto);
  }

  @Delete(':id/inventories/:inventoryId')
  @HttpCode(204)
  unassignInventory(
    @Param('id', ParseIntPipe) id: number,
    @Param('inventoryId', ParseIntPipe) inventoryId: number,
  ): Promise<void> {
    return this.specialOffersService.unassignInventory(id, inventoryId);
  }
}
