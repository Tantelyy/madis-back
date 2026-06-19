import { PermissionEntity } from '../../permissions/entities/permission.entity';
import { RoleEntity } from './role.entity';

export class RolePermissionEntity {
  id: number;
  roleId: number;
  permissionId: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: number | null;
  deletedBy: number | null;
  role?: RoleEntity;
  permission?: PermissionEntity;
}
