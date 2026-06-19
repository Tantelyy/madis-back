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
}
