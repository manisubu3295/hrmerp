import * as client from 'openid-client';
import { decryptField } from './encryption';

// Provider-agnostic OIDC scaffold — disabled by default. This can't be
// "finished" without a real org admin plugging in real IdP credentials
// (Okta/Azure AD/Google Workspace/etc.) via the OrganizationSsoConfig CRUD
// in settings.routes.ts. Until then, the /auth/sso/:orgCode/* routes return
// 503 before any of this code runs.
//
// State/PKCE verifier storage is in-memory, which is fine for a single API
// instance in dev but won't survive a restart or work across multiple
// instances — needs to move to Redis when this becomes real (Phase 7).

interface PendingAuth {
  codeVerifier: string;
  organizationId: string;
  createdAt: number;
}

const pendingAuths = new Map<string, PendingAuth>();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanupExpired(): void {
  const now = Date.now();
  for (const [state, entry] of pendingAuths) {
    if (now - entry.createdAt > STATE_TTL_MS) pendingAuths.delete(state);
  }
}

interface OrgSsoConfig {
  organizationId: string;
  issuerUrl: string | null;
  clientId: string | null;
  clientSecretEncrypted: string | null;
}

async function discoverConfig(org: OrgSsoConfig): Promise<client.Configuration> {
  if (!org.issuerUrl || !org.clientId || !org.clientSecretEncrypted) {
    throw new Error('SSO is not fully configured for this organization');
  }
  const clientSecret = decryptField(org.clientSecretEncrypted);
  return client.discovery(new URL(org.issuerUrl), org.clientId, clientSecret);
}

export async function buildAuthorizationUrl(org: OrgSsoConfig, redirectUri: string): Promise<string> {
  cleanupExpired();
  const config = await discoverConfig(org);

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  pendingAuths.set(state, { codeVerifier, organizationId: org.organizationId, createdAt: Date.now() });

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  return url.href;
}

export interface SsoCallbackResult {
  sub: string;
  email: string | undefined;
  organizationId: string;
}

export async function handleCallback(org: OrgSsoConfig, callbackUrl: URL): Promise<SsoCallbackResult> {
  const state = callbackUrl.searchParams.get('state');
  const pending = state ? pendingAuths.get(state) : undefined;
  if (!state || !pending) throw new Error('Invalid or expired SSO state');
  pendingAuths.delete(state);

  const config = await discoverConfig(org);
  const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: pending.codeVerifier,
    expectedState: state,
  });
  const claims = tokens.claims();
  if (!claims) throw new Error('SSO provider did not return identity claims');

  return { sub: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined, organizationId: org.organizationId };
}
