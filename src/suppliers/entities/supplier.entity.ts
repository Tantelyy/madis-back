export class SupplierUserEntity {
  id!: number;
  userName!: string;
  email!: string;
}

export class SupplierEntity {
  id!: number;
  name!: string;
  address!: string | null;
  phone!: string | null;
  email!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  createdBy!: number;
  updatedBy!: number | null;
  deletedBy!: number | null;
  createdByUser?: SupplierUserEntity;
  updatedByUser?: SupplierUserEntity | null;
  deletedByUser?: SupplierUserEntity | null;
}
