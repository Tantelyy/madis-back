import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SaleImportService } from './sale-import.service';

@Module({
  imports: [AuthModule],
  controllers: [SalesController],
  providers: [SalesService, SaleImportService],
})
export class SalesModule {}
