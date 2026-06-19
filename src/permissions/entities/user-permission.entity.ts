import { UserEntity } from '../../users/entities/user.entity';
import { PermissionEntity } from './permission.entity';

export class UserPermissionEntity {
  id: number;
  userId: number;
  permissionId: number;
  createdAt: Date;
  createdBy: number | null;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: number | null;
  user?: UserEntity;
  permission?: PermissionEntity;
}
