import { ForbiddenException } from '@nestjs/common';
import { assertRoleDeviceAccess, isMobileClient } from './device-access.util';

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127 Safari/537.36';
const PHONE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/127 Mobile Safari/537.36';
const TABLET_USER_AGENT =
  'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Version/17.6 Mobile/15E148 Safari/604.1';

describe('device access policy', () => {
  it('detects phones, tablets and mobile client hints', () => {
    expect(isMobileClient({ 'user-agent': PHONE_USER_AGENT })).toBe(true);
    expect(isMobileClient({ 'user-agent': TABLET_USER_AGENT })).toBe(true);
    expect(isMobileClient({ 'sec-ch-ua-mobile': '?1' })).toBe(true);
  });

  it('allows desktop browsers', () => {
    expect(isMobileClient({ 'user-agent': DESKTOP_USER_AGENT })).toBe(false);
    expect(
      isMobileClient({
        'user-agent': DESKTOP_USER_AGENT,
        'sec-ch-ua-mobile': '?0',
      }),
    ).toBe(false);
  });

  it.each(['SELLER', 'STOCK_MANAGER'])(
    'blocks %s on a mobile device',
    (role) => {
      expect(() =>
        assertRoleDeviceAccess(role, { 'user-agent': PHONE_USER_AGENT }),
      ).toThrow(
        new ForbiddenException(
          'Ce compte est accessible uniquement depuis un navigateur sur ordinateur.',
        ),
      );
    },
  );

  it('allows ADMIN on a mobile device', () => {
    expect(() =>
      assertRoleDeviceAccess('ADMIN', { 'user-agent': PHONE_USER_AGENT }),
    ).not.toThrow();
  });
});
