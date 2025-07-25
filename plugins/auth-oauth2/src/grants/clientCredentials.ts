import type { Context } from '@yaakapp/api';
import { fetchAccessToken } from '../fetchAccessToken';
import type { TokenStoreArgs } from '../store';
import { getToken, storeToken } from '../store';
import { isTokenExpired } from '../util';

export async function getClientCredentials(
  ctx: Context,
  contextId: string,
  {
    accessTokenUrl,
    clientId,
    clientSecret,
    scope,
    audience,
    credentialsInBody,
  }: {
    accessTokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope: string | null;
    audience: string | null;
    credentialsInBody: boolean;
  },
) {
  const tokenArgs: TokenStoreArgs = {
    contextId,
    clientId,
    accessTokenUrl,
    authorizationUrl: null,
  };
  const token = await getToken(ctx, tokenArgs);
  if (token && !isTokenExpired(token)) {
    return token;
  }

  const response = await fetchAccessToken(ctx, {
    grantType: 'client_credentials',
    accessTokenUrl,
    audience,
    clientId,
    clientSecret,
    scope,
    credentialsInBody,
    params: [],
  });

  return storeToken(ctx, tokenArgs, response);
}
