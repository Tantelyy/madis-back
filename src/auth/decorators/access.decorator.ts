import { SetMetadata } from '@nestjs/common';

export const ACCESS_REQUIREMENTS_KEY = 'access_requirements';

export interface AccessRequirements {
  roles?: string[];
  permissions?: string[];
}

export const RequireAccess = (
  requirements: AccessRequirements,
): ReturnType<typeof SetMetadata> =>
  SetMetadata(ACCESS_REQUIREMENTS_KEY, requirements);
