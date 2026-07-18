import { NextRequest } from 'next/server';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { getJwtSecret } from './env';

export type AuthUser = {
  id: number;
  username?: string;
  name?: string;
  role: string;
};

export function verifyAuthToken(token?: string): AuthUser | null {
  if (!token) return null;

  const jwtSecret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded === 'string') return null;

    const payload = decoded as JwtPayload & {
      id?: unknown;
      username?: unknown;
      name?: unknown;
      role?: unknown;
    };

    if (typeof payload.id !== 'number' || typeof payload.role !== 'string') {
      return null;
    }

    return {
      id: payload.id,
      username: typeof payload.username === 'string' ? payload.username : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function getUserFromRequest(request: NextRequest): AuthUser | null {
  return verifyAuthToken(request.cookies.get('auth_token')?.value);
}

export function getUserIdFromRequest(request: NextRequest): number | null {
  return getUserFromRequest(request)?.id ?? null;
}

export function isAdminRequest(request: NextRequest): boolean {
  return getUserFromRequest(request)?.role === 'ADMIN';
}
