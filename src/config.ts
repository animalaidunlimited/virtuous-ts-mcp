import { z } from 'zod';

const DEFAULT_BASE_URL = 'https://api.virtuoussoftware.com/api/';

/**
 * Environment the process was started with.
 * Parsed once at startup. A missing API key fails fast, before stdio starts,
 * so the host sees a clear stderr line instead of a hung handshake.
 */
const EnvSchema = z.object({
  VIRTUOUS_API_KEY: z.string().min(1, 'VIRTUOUS_API_KEY is required'),
  VIRTUOUS_BASE_URL: z.string().min(1).default(DEFAULT_BASE_URL),
  VIRTUOUS_MAX_RECORDS: z.coerce.number().int().positive().default(10_000),
  VIRTUOUS_RATE_RESERVE: z.coerce.number().int().nonnegative().default(50),
  /**
   * Parsed so a host config can already set the flag.
   * v0.1 does not register write tools either way. See index.ts.
   */
  VIRTUOUS_ALLOW_WRITES: z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((value) => value === 'true' || value === '1'),
});

export interface AppConfig {
  apiKey: string;
  baseURL: string;
  maxRecords: number;
  rateLimitReserve: number;
  allowWrites: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const missingKey = parsed.error.issues.some((issue) => issue.path[0] === 'VIRTUOUS_API_KEY');
    if (missingKey) {
      throw new Error(
        'VIRTUOUS_API_KEY is required. Set it in the MCP host env (see .env.example). The server will not start.',
      );
    }
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${detail}`);
  }

  const data = parsed.data;
  return {
    apiKey: data.VIRTUOUS_API_KEY,
    baseURL: data.VIRTUOUS_BASE_URL,
    maxRecords: data.VIRTUOUS_MAX_RECORDS,
    rateLimitReserve: data.VIRTUOUS_RATE_RESERVE,
    allowWrites: data.VIRTUOUS_ALLOW_WRITES,
  };
}
