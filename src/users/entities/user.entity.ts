import { RoleEntity } from '../../roles/entities/role.entity';
import { PermissionEntity } from '../../permissions/entities/permission.entity';

export class UserEntity {
  id: number;
  email: string;
  password: string;
  userName: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  roleId: number;
  role?: RoleEntity;
  permissions?: PermissionEntity[];
}
