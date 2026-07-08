import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireAccess } from '../auth/decorators/access.decorator';
import { AccessGuard } from '../auth/guards/access.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleEntity } from './entities/role.entity';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, AccessGuard)
@RequireAccess({
  roles: ['ADMIN'],
  permissions: ['ALL', 'CAN_MANAGE_ACCOUNTS'],
})
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(): Promise<RoleEntity[]> {
    return this.rolesService.findAll();
  }
}
