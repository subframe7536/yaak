import type { AccessToken } from './store';

export function isTokenExpired(token: AccessToken) {
  return token.expiresAt && Date.now() > token.expiresAt;
}
