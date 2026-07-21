import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpecialOffersController } from './special-offers.controller';
import { SpecialOffersService } from './special-offers.service';

@Module({
  imports: [AuthModule],
  controllers: [SpecialOffersController],
  providers: [SpecialOffersService],
})
export class SpecialOffersModule {}
