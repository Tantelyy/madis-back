import { UserEntity } from '../entities/user.entity';

export interface PaginatedUsers {
  data: UserEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
