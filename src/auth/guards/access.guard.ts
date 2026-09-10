import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ACCESS_REQUIREMENTS_KEY,
  AccessRequirements,
} from '../decorators/access.decorator';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requirements = this.reflector.getAllAndOverride<AccessRequirements>(
      ACCESS_REQUIREMENTS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requirements) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const roles = requirements.roles ?? [];
    const permissions = requirements.permissions ?? [];

    const hasRole = roles.includes(user.role);
    const hasPermission = permissions.some((permission) =>
      user.permissions.includes(permission),
    );

    return hasRole || hasPermission;
  }
}
