import { ForbiddenException } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';

const DESKTOP_ONLY_ROLES = new Set(['SELLER', 'STOCK_MANAGER']);
const MOBILE_USER_AGENT_PATTERN =
  /android|blackberry|iemobile|ipad|iphone|ipod|mobile|opera mini|tablet|webos/i;

function getHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isMobileClient(headers: IncomingHttpHeaders): boolean {
  const mobileClientHint = getHeaderValue(headers['sec-ch-ua-mobile']);

  if (mobileClientHint?.trim() === '?1') {
    return true;
  }

  const userAgent = getHeaderValue(headers['user-agent']);
  return userAgent ? MOBILE_USER_AGENT_PATTERN.test(userAgent) : false;
}

export function assertRoleDeviceAccess(
  role: string,
  headers: IncomingHttpHeaders,
): void {
  if (DESKTOP_ONLY_ROLES.has(role) && isMobileClient(headers)) {
    throw new ForbiddenException(
      'Ce compte est accessible uniquement depuis un navigateur sur ordinateur.',
    );
  }
}
