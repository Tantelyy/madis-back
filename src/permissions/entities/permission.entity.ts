export class PermissionEntity {
  id!: number;
  label!: string;
  code!: string;
  descriptions!: string | null;
  createdBy!: number | null;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  deletedBy!: number | null;
}
