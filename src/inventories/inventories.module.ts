import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoriesController } from './inventories.controller';
import { InventoryImportService } from './inventory-import.service';
import { InventoryPricingService } from './inventory-pricing.service';
import { InventoriesService } from './inventories.service';

@Module({
  imports: [AuthModule],
  controllers: [InventoriesController],
  providers: [
    InventoriesService,
    InventoryImportService,
    InventoryPricingService,
  ],
})
export class InventoriesModule {}
