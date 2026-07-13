import { timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_AUDIENCE = 'gegarap-production-maintenance';
const GITHUB_REPOSITORY = 'dannytampan23/gegarap.id';
const GITHUB_WORKFLOW_REF = `${GITHUB_REPOSITORY}/.github/workflows/maintenance.yml@refs/heads/main`;
const githubJwks = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`));

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function matchesSecret(token: string, secret: string): boolean {
  if (token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

async function isGitHubMaintenanceToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, githubJwks, {
      issuer: GITHUB_ISSUER,
      audience: GITHUB_AUDIENCE,
    });
    return (
      payload.repository === GITHUB_REPOSITORY &&
      payload.ref === 'refs/heads/main' &&
      payload.workflow_ref === GITHUB_WORKFLOW_REF &&
      (payload.event_name === 'schedule' || payload.event_name === 'workflow_dispatch')
    );
  } catch {
    return false;
  }
}

/**
 * Authorise Vercel Cron with CRON_SECRET or the pinned GitHub Actions maintenance
 * workflow with a short-lived OIDC token. Without either credential, requests
 * are allowed only outside production so local cron testing remains ergonomic.
 */
export async function isAuthorizedCron(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const token = bearerToken(req);

  if (!token) return !secret && process.env.NODE_ENV !== 'production';
  if (secret && matchesSecret(token, secret)) return true;

  return isGitHubMaintenanceToken(token);
}
