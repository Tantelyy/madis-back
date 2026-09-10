import { PermissionEntity } from '../../permissions/entities/permission.entity';

export class RoleEntity {
  id!: number;
  label!: string;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  createdBy!: number | null;
  deletedBy!: number | null;
  permissions?: PermissionEntity[];
}
