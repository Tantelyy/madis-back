import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  ListProductsQueryDto,
  ProductSortField,
  ProductSortOrder,
} from './dto/list-products-query.dto';
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

const PRODUCT_USER_SELECT = {
  id: true,
  userName: true,
  email: true,
} satisfies Prisma.UserSelect;

const PRODUCT_INCLUDE = {
  mark: true,
  specification: true,
  format: true,
  productType: true,
  createdByUser: {
    select: PRODUCT_USER_SELECT,
  },
  updatedByUser: {
    select: PRODUCT_USER_SELECT,
  },
  deletedByUser: {
    select: PRODUCT_USER_SELECT,
  },
} satisfies Prisma.ProductInclude;

const PRODUCT_NAME_INCLUDE = {
  mark: true,
  specification: true,
  format: true,
  productType: true,
} satisfies Prisma.ProductInclude;

type ProductNamePayload = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_NAME_INCLUDE;
}>;

type ProductReferenceField =
  | 'markId'
  | 'specificationId'
  | 'formatId'
  | 'productTypeId';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createProductDto: CreateProductDto,
    userId: number,
  ): Promise<ProductEntity> {
    const reference = createProductDto.reference.trim();
    await this.ensureReferenceIsAvailable(reference);
    const productName = await this.buildProductName(createProductDto);

    try {
      return await this.prisma.product.create({
        data: {
          ...createProductDto,
          reference,
          name: productName,
          createdBy: userId,
        },
        include: PRODUCT_INCLUDE,
      });
    } catch (error) {
      this.handleProductReferenceConflict(error);
    }
  }

  async findAll(query: ListProductsQueryDto): Promise<PaginatedProducts> {
    const where = this.buildListWhere(query.search);
    const skip = (query.page - 1) * query.limit;
    const orderBy = this.buildOrderBy(query.sortBy, query.order);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy,
        skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: number): Promise<ProductEntity> {
    return this.findActiveProductOrThrow(id);
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
    userId: number,
  ): Promise<ProductEntity> {
    const product = await this.findActiveProductOrThrow(id);
    const reference = updateProductDto.reference?.trim();
    await this.ensureReferenceIsAvailable(reference, id);
    const productName = await this.buildProductName({
      markId: updateProductDto.markId ?? product.markId,
      specificationId:
        updateProductDto.specificationId ?? product.specificationId,
      formatId: updateProductDto.formatId ?? product.formatId,
      productTypeId: updateProductDto.productTypeId ?? product.productTypeId,
    });

    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          ...updateProductDto,
          reference,
          name: productName,
          updatedBy: userId,
        },
        include: PRODUCT_INCLUDE,
      });
    } catch (error) {
      this.handleProductReferenceConflict(error);
    }
  }

  async remove(id: number, userId: number): Promise<void> {
    await this.findActiveProductOrThrow(id);

    await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });
  }

  createMark(dto: ProductMarkDto): Promise<ProductMarkEntity> {
    return this.prisma.productMark.create({ data: dto });
  }

  findAllMarks(): Promise<ProductMarkEntity[]> {
    return this.prisma.productMark.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOneMark(id: number): Promise<ProductMarkEntity> {
    const mark = await this.prisma.productMark.findUnique({ where: { id } });

    if (!mark) {
      throw new NotFoundException('Marque de produit introuvable.');
    }

    return mark;
  }

  async updateMark(
    id: number,
    dto: ProductMarkDto,
  ): Promise<ProductMarkEntity> {
    await this.findOneMark(id);

    return this.prisma.$transaction(async (tx) => {
      const mark = await tx.productMark.update({
        where: { id },
        data: dto,
      });

      await this.refreshProductNamesByReference(tx, 'markId', id);

      return mark;
    });
  }

  async removeMark(id: number): Promise<void> {
    await this.findOneMark(id);
    await this.ensureReferenceIsUnused(
      'markId',
      id,
      'Impossible de supprimer cette marque car elle est utilisée par un produit.',
      true,
    );
    await this.prisma.productMark.delete({ where: { id } });
  }

  createSpecification(
    dto: ProductSpecificationDto,
  ): Promise<ProductSpecificationEntity> {
    return this.prisma.productSpecification.create({ data: dto });
  }

  findAllSpecifications(): Promise<ProductSpecificationEntity[]> {
    return this.prisma.productSpecification.findMany({
      where: { deletedAt: null },
      orderBy: { specification: 'asc' },
    });
  }

  async findOneSpecification(id: number): Promise<ProductSpecificationEntity> {
    const specification = await this.prisma.productSpecification.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!specification) {
      throw new NotFoundException('Specification de produit introuvable.');
    }

    return specification;
  }

  async updateSpecification(
    id: number,
    dto: ProductSpecificationDto,
  ): Promise<ProductSpecificationEntity> {
    await this.findOneSpecification(id);

    return this.prisma.$transaction(async (tx) => {
      const specification = await tx.productSpecification.update({
        where: { id },
        data: dto,
      });

      await this.refreshProductNamesByReference(tx, 'specificationId', id);

      return specification;
    });
  }

  async removeSpecification(id: number): Promise<void> {
    await this.findOneSpecification(id);
    await this.ensureReferenceIsUnused(
      'specificationId',
      id,
      'Impossible de supprimer cette spécification car elle est utilisée par un produit.',
    );
    await this.prisma.productSpecification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  createFormat(dto: ProductFormatDto): Promise<ProductFormatEntity> {
    return this.prisma.productFormat.create({ data: dto });
  }

  findAllFormats(): Promise<ProductFormatEntity[]> {
    return this.prisma.productFormat.findMany({
      orderBy: { format: 'asc' },
    });
  }

  async findOneFormat(id: number): Promise<ProductFormatEntity> {
    const format = await this.prisma.productFormat.findUnique({
      where: { id },
    });

    if (!format) {
      throw new NotFoundException('Format de produit introuvable.');
    }

    return format;
  }

  async updateFormat(
    id: number,
    dto: ProductFormatDto,
  ): Promise<ProductFormatEntity> {
    await this.findOneFormat(id);

    return this.prisma.$transaction(async (tx) => {
      const format = await tx.productFormat.update({
        where: { id },
        data: dto,
      });

      await this.refreshProductNamesByReference(tx, 'formatId', id);

      return format;
    });
  }

  async removeFormat(id: number): Promise<void> {
    await this.findOneFormat(id);
    await this.ensureReferenceIsUnused(
      'formatId',
      id,
      'Impossible de supprimer ce format car il est utilisé par un produit.',
      true,
    );
    await this.prisma.productFormat.delete({ where: { id } });
  }

  createType(dto: ProductTypeDto): Promise<ProductTypeEntity> {
    return this.prisma.productType.create({ data: dto });
  }

  findAllTypes(): Promise<ProductTypeEntity[]> {
    return this.prisma.productType.findMany({
      orderBy: { type: 'asc' },
    });
  }

  async findOneType(id: number): Promise<ProductTypeEntity> {
    const productType = await this.prisma.productType.findUnique({
      where: { id },
    });

    if (!productType) {
      throw new NotFoundException('Type de produit introuvable.');
    }

    return productType;
  }

  async updateType(
    id: number,
    dto: ProductTypeDto,
  ): Promise<ProductTypeEntity> {
    await this.findOneType(id);

    return this.prisma.$transaction(async (tx) => {
      const productType = await tx.productType.update({
        where: { id },
        data: dto,
      });

      await this.refreshProductNamesByReference(tx, 'productTypeId', id);

      return productType;
    });
  }

  async removeType(id: number): Promise<void> {
    await this.findOneType(id);
    await this.ensureReferenceIsUnused(
      'productTypeId',
      id,
      'Impossible de supprimer ce type car il est utilisé par un produit.',
      true,
    );
    await this.prisma.productType.delete({ where: { id } });
  }

  private async findActiveProductOrThrow(id: number): Promise<ProductEntity> {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }

    return product;
  }

  private async ensureReferenceIsAvailable(
    reference?: string,
    ignoredProductId?: number,
  ): Promise<void> {
    const trimmedReference = reference?.trim();

    if (!trimmedReference) {
      return;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        reference: trimmedReference,
        id: ignoredProductId ? { not: ignoredProductId } : undefined,
      },
    });

    if (product) {
      throw new ConflictException('Cette référence produit existe déjà.');
    }
  }

  private handleProductReferenceConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Cette référence produit existe déjà.');
    }

    throw error;
  }

  private async buildProductName(productDto: {
    markId: number;
    specificationId: number;
    formatId: number;
    productTypeId: number;
  }): Promise<string> {
    const [mark, specification, format, productType] = await Promise.all([
      this.findMarkForProduct(productDto.markId),
      this.findSpecificationForProduct(productDto.specificationId),
      this.findFormatForProduct(productDto.formatId),
      this.findTypeForProduct(productDto.productTypeId),
    ]);

    return this.composeProductName({
      mark,
      specification,
      format,
      productType,
    });
  }

  private composeProductName(
    product: Pick<
      ProductNamePayload,
      'mark' | 'specification' | 'format' | 'productType'
    >,
  ): string {
    return [
      product.productType.type,
      product.mark.name,
      product.specification.specification,
      product.format.format,
    ].join(' ');
  }

  private async refreshProductNamesByReference(
    tx: Prisma.TransactionClient,
    field: ProductReferenceField,
    id: number,
  ): Promise<void> {
    const products = await tx.product.findMany({
      where: { [field]: id },
      include: PRODUCT_NAME_INCLUDE,
    });

    await Promise.all(
      products.map((product) =>
        tx.product.update({
          where: { id: product.id },
          data: {
            name: this.composeProductName(product),
          },
        }),
      ),
    );
  }

  private async findMarkForProduct(id: number): Promise<ProductMarkEntity> {
    const mark = await this.prisma.productMark.findUnique({ where: { id } });

    if (!mark) {
      throw new BadRequestException('La marque du produit est introuvable.');
    }

    return mark;
  }

  private async findSpecificationForProduct(
    id: number,
  ): Promise<ProductSpecificationEntity> {
    const specification = await this.prisma.productSpecification.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!specification) {
      throw new BadRequestException(
        'La spécification du produit est introuvable.',
      );
    }

    return specification;
  }

  private async findFormatForProduct(id: number): Promise<ProductFormatEntity> {
    const format = await this.prisma.productFormat.findUnique({
      where: { id },
    });

    if (!format) {
      throw new BadRequestException('Le format du produit est introuvable.');
    }

    return format;
  }

  private async findTypeForProduct(id: number): Promise<ProductTypeEntity> {
    const productType = await this.prisma.productType.findUnique({
      where: { id },
    });

    if (!productType) {
      throw new BadRequestException('Le type du produit est introuvable.');
    }

    return productType;
  }

  private async ensureReferenceIsUnused(
    field: ProductReferenceField,
    id: number,
    message: string,
    includeDeletedProducts: boolean = false,
  ): Promise<void> {
    const productCount = await this.prisma.product.count({
      where: includeDeletedProducts
        ? { [field]: id }
        : {
            [field]: id,
            deletedAt: null,
          },
    });

    if (productCount > 0) {
      throw new BadRequestException(message);
    }
  }

  private buildListWhere(search?: string): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
    };
    const trimmedSearch = search?.trim();

    if (!trimmedSearch) {
      return where;
    }

    return {
      ...where,
      OR: [
        { name: { contains: trimmedSearch, mode: 'insensitive' } },
        { reference: { contains: trimmedSearch, mode: 'insensitive' } },
        { mark: { name: { contains: trimmedSearch, mode: 'insensitive' } } },
        {
          specification: {
            specification: { contains: trimmedSearch, mode: 'insensitive' },
          },
        },
        {
          format: { format: { contains: trimmedSearch, mode: 'insensitive' } },
        },
        {
          productType: {
            type: { contains: trimmedSearch, mode: 'insensitive' },
          },
        },
      ],
    };
  }

  private buildOrderBy(
    sortBy: ProductSortField,
    order: ProductSortOrder,
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sortBy) {
      case 'name':
        return { name: order };
      case 'reference':
        return { reference: order };
      case 'updatedAt':
        return { updatedAt: order };
      case 'deletedAt':
        return { deletedAt: order };
      case 'createdAt':
      default:
        return { createdAt: order };
    }
  }
}
