import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { ListInventoriesQueryDto } from './dto/list-inventories-query.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryEntity } from './entities/inventory.entity';
import { PaginatedInventories } from './interfaces/paginated-inventories.interface';
import { InventoriesService } from './inventories.service';

@Controller('inventories')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireAccess({
  roles: ['ADMIN'],
  permissions: ['CAN_INVENTORY', 'ALL'],
})
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Post()
  create(
    @Body() createInventoryDto: CreateInventoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryEntity> {
    return this.inventoriesService.create(createInventoryDto, user.id);
  }

  @Get()
  findAll(
    @Query() query: ListInventoriesQueryDto,
  ): Promise<PaginatedInventories> {
    return this.inventoriesService.findAll(query);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInventoryDto: UpdateInventoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryEntity> {
    return this.inventoriesService.update(id, updateInventoryDto, user.id);
  }
}
