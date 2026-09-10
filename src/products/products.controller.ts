import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductFormatDto } from './dto/product-format.dto';
import { ProductMarkDto } from './dto/product-mark.dto';
import { ProductSpecificationDto } from './dto/product-specification.dto';
import { ProductTypeDto } from './dto/product-type.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFormatEntity } from './entities/product-format.entity';
import { ProductMarkEntity } from './entities/product-mark.entity';
import { ProductSpecificationEntity } from './entities/product-specification.entity';
import { ProductTypeEntity } from './entities/product-type.entity';
import { ProductEntity } from './entities/product.entity';
import { PaginatedProducts } from './interfaces/paginated-products.interface';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireAccess({
  roles: ['ADMIN'],
  permissions: ['CAN_PRODUCTS', 'ALL'],
})
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductEntity> {
    return this.productsService.create(createProductDto, user.id);
  }

  @Get()
  findAll(@Query() query: ListProductsQueryDto): Promise<PaginatedProducts> {
    return this.productsService.findAll(query);
  }

  @Post('marks')
  createMark(@Body() dto: ProductMarkDto): Promise<ProductMarkEntity> {
    return this.productsService.createMark(dto);
  }

  @Get('marks')
  findAllMarks(): Promise<ProductMarkEntity[]> {
    return this.productsService.findAllMarks();
  }

  @Get('marks/:id')
  findOneMark(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductMarkEntity> {
    return this.productsService.findOneMark(id);
  }

  @Patch('marks/:id')
  updateMark(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProductMarkDto,
  ): Promise<ProductMarkEntity> {
    return this.productsService.updateMark(id, dto);
  }

  @Delete('marks/:id')
  @HttpCode(204)
  removeMark(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productsService.removeMark(id);
  }

  @Post('specifications')
  createSpecification(
    @Body() dto: ProductSpecificationDto,
  ): Promise<ProductSpecificationEntity> {
    return this.productsService.createSpecification(dto);
  }

  @Get('specifications')
  findAllSpecifications(): Promise<ProductSpecificationEntity[]> {
    return this.productsService.findAllSpecifications();
  }

  @Get('specifications/:id')
  findOneSpecification(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductSpecificationEntity> {
    return this.productsService.findOneSpecification(id);
  }

  @Patch('specifications/:id')
  updateSpecification(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProductSpecificationDto,
  ): Promise<ProductSpecificationEntity> {
    return this.productsService.updateSpecification(id, dto);
  }

  @Delete('specifications/:id')
  @HttpCode(204)
  removeSpecification(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productsService.removeSpecification(id);
  }

  @Post('formats')
  createFormat(@Body() dto: ProductFormatDto): Promise<ProductFormatEntity> {
    return this.productsService.createFormat(dto);
  }

  @Get('formats')
  findAllFormats(): Promise<ProductFormatEntity[]> {
    return this.productsService.findAllFormats();
  }

  @Get('formats/:id')
  findOneFormat(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductFormatEntity> {
    return this.productsService.findOneFormat(id);
  }

  @Patch('formats/:id')
  updateFormat(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProductFormatDto,
  ): Promise<ProductFormatEntity> {
    return this.productsService.updateFormat(id, dto);
  }

  @Delete('formats/:id')
  @HttpCode(204)
  removeFormat(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productsService.removeFormat(id);
  }

  @Post('types')
  createType(@Body() dto: ProductTypeDto): Promise<ProductTypeEntity> {
    return this.productsService.createType(dto);
  }

  @Get('types')
  findAllTypes(): Promise<ProductTypeEntity[]> {
    return this.productsService.findAllTypes();
  }

  @Get('types/:id')
  findOneType(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductTypeEntity> {
    return this.productsService.findOneType(id);
  }

  @Patch('types/:id')
  updateType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProductTypeDto,
  ): Promise<ProductTypeEntity> {
    return this.productsService.updateType(id, dto);
  }

  @Delete('types/:id')
  @HttpCode(204)
  removeType(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productsService.removeType(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ProductEntity> {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductEntity> {
    return this.productsService.update(id, updateProductDto, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.productsService.remove(id, user.id);
  }
}
