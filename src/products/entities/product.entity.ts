import { ProductFormatEntity } from './product-format.entity';
import { ProductMarkEntity } from './product-mark.entity';
import { ProductSpecificationEntity } from './product-specification.entity';
import { ProductTypeEntity } from './product-type.entity';

export class ProductUserEntity {
  id!: number;
  userName!: string;
  email!: string;
}

export class ProductEntity {
  id!: number;
  name!: string;
  reference!: string;
  markId!: number;
  specificationId!: number;
  formatId!: number;
  productTypeId!: number;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  deletedBy!: number | null;
  createdBy!: number;
  image!: string | null;
  updatedBy!: number | null;
  mark?: ProductMarkEntity;
  specification?: ProductSpecificationEntity;
  format?: ProductFormatEntity;
  productType?: ProductTypeEntity;
  createdByUser?: ProductUserEntity;
  updatedByUser?: ProductUserEntity | null;
  deletedByUser?: ProductUserEntity | null;
}
