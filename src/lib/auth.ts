import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { getJwtSecret } from './env';
import { query } from './db';

export type AuthUser = { id: number; username: string; name?: string; role: string };
type SessionClaims = { id: number; passwordVersion: string };
type AuthRow = AuthUser & { password: string; is_active: number };

// A keyed fingerprint revokes existing sessions when the password hash changes,
// without exposing the password hash or requiring a database schema change.
export function getPasswordVersion(hash: string): string {
  return createHmac('sha256', getJwtSecret()).update(hash).digest('base64url');
}

export function createAuthToken(user: Pick<AuthRow, 'id' | 'password'>): string {
  return jwt.sign({ id: user.id, passwordVersion: getPasswordVersion(user.password) },
    getJwtSecret(), { algorithm: 'HS256', expiresIn: '1d' });
}

export function verifyAuthToken(token?: string): SessionClaims | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as JwtPayload;
    if (!Number.isSafeInteger(payload.id) || payload.id <= 0 || typeof payload.passwordVersion !== 'string') return null;
    return { id: payload.id, passwordVersion: payload.passwordVersion };
  } catch { return null; }
}

export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const claims = verifyAuthToken(request.cookies.get('auth_token')?.value);
  if (!claims) return null;
  const user = (await query<AuthRow>(
    'SELECT id, username, name, role, is_active, password FROM users WHERE id = $1', [claims.id]
  )).rows[0];
  if (!user || user.is_active !== 1) return null;
  const expected = Buffer.from(getPasswordVersion(user.password));
  const actual = Buffer.from(claims.passwordVersion);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  // Always use the current database role, never the token's historical role.
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

export async function getUserIdFromRequest(request: NextRequest): Promise<number | null> {
  return (await getUserFromRequest(request))?.id ?? null;
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  return (await getUserFromRequest(request))?.role === 'ADMIN';
}
