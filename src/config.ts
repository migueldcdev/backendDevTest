function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number, got "${raw}"`);
  return value;
}

export const config = {
  port: readNumber('PORT', 5000),
  upstream: {
    baseUrl: process.env.UPSTREAM_BASE_URL ?? 'http://localhost:3001',
    timeoutMs: readNumber('UPSTREAM_TIMEOUT_MS', 2000),
  },
} as const;
