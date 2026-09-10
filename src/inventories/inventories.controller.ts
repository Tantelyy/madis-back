import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import {
  ListInventoriesQueryDto,
  ListInventoryMovementsQueryDto,
} from './dto/list-inventories-query.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { ListStockSummaryQueryDto } from './dto/list-stock-summary-query.dto';
import { UpdateStockLimitDto } from './dto/update-stock-limit.dto';
import { PaginatedInventoryMovements } from './interfaces/paginated-inventory-movements.interface';
import { InventoryFormOptions } from './interfaces/inventory-form-options.interface';
import { InventoryEntity } from './entities/inventory.entity';
import { PaginatedInventories } from './interfaces/paginated-inventories.interface';
import { PaginatedStockSummary } from './interfaces/paginated-stock-summary.interface';
import { StockLimitEntity } from './entities/stock-limit.entity';
import { InventoriesService } from './inventories.service';
import { InventoryImportService } from './inventory-import.service';
import {
  INVENTORY_CSV_MAX_FILE_SIZE,
  type InventoryImportSummary,
  type UploadedInventoryCsvFile,
} from './interfaces/inventory-import.interface';

@Controller('inventories')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireAccess({
  roles: ['ADMIN', 'STOCK_MANAGER'],
  permissions: ['CAN_INVENTORY', 'ALL'],
})
export class InventoriesController {
  constructor(
    private readonly inventoriesService: InventoriesService,
    private readonly inventoryImportService: InventoryImportService,
  ) {}

  @Post()
  create(
    @Body() createInventoryDto: CreateInventoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryEntity> {
    return this.inventoriesService.create(createInventoryDto, user.id);
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: INVENTORY_CSV_MAX_FILE_SIZE, files: 1 },
    }),
  )
  importCsv(
    @UploadedFile() file: UploadedInventoryCsvFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryImportSummary> {
    return this.inventoryImportService.importCsv(file, user.id);
  }

  @Get()
  findAll(
    @Query() query: ListInventoriesQueryDto,
  ): Promise<PaginatedInventories> {
    return this.inventoriesService.findAll(query);
  }

  @Get('stock-summary')
  @RequireAccess({
    roles: ['ADMIN', 'STOCK_MANAGER'],
    permissions: ['ALL', 'CAN_VIEW_STOCK', 'CAN_MANAGE_ACCOUNTS'],
  })
  findStockSummary(
    @Query() query: ListStockSummaryQueryDto,
  ): Promise<PaginatedStockSummary> {
    return this.inventoriesService.findStockSummary(query);
  }

  @Get('stock-limit')
  @RequireAccess({
    roles: ['ADMIN', 'STOCK_MANAGER'],
    permissions: ['ALL', 'CAN_VIEW_STOCK', 'CAN_MANAGE_ACCOUNTS'],
  })
  findStockLimit(): Promise<StockLimitEntity> {
    return this.inventoriesService.findCurrentStockLimit();
  }

  @Post('stock-limit')
  @RequireAccess({
    roles: ['ADMIN', 'STOCK_MANAGER'],
    permissions: ['ALL', 'CAN_VIEW_STOCK', 'CAN_MANAGE_ACCOUNTS'],
  })
  createStockLimit(
    @Body() dto: UpdateStockLimitDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StockLimitEntity> {
    return this.inventoriesService.createStockLimit(dto.value, user.id);
  }

  @Get('form-options')
  findFormOptions(): Promise<InventoryFormOptions> {
    return this.inventoriesService.findFormOptions();
  }

  @Get('movements')
  findAllMovements(
    @Query() query: ListInventoryMovementsQueryDto,
  ): Promise<PaginatedInventoryMovements> {
    return this.inventoriesService.findAllMovements(query);
  }

  @Get(':id/movements')
  findInventoryMovements(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListInventoryMovementsQueryDto,
  ): Promise<PaginatedInventoryMovements> {
    return this.inventoriesService.findInventoryMovements(id, query);
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
