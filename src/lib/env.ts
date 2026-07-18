export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

export function getInitialAdminConfig() {
  return {
    username: getRequiredEnv('ADMIN_USERNAME'),
    password: getRequiredEnv('ADMIN_PASSWORD'),
    name: process.env.ADMIN_NAME?.trim() || '운영자',
  };
}

export function getInitialAdminUsername(): string {
  return getRequiredEnv('ADMIN_USERNAME');
}

export function getJwtSecret(): string {
  return getRequiredEnv('JWT_SECRET');
}
