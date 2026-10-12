import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  VirtuousApiError,
  VirtuousQueryValidationError,
  VirtuousRateLimitError,
} from 'virtuous-ts';

/** JSON text the model can read. Pretty-printed so a human inspector can too. */
export function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Error the model should read and correct. Do not throw for these.
 * Throwing is reserved for bugs in this server.
 */
export function fail(message: string, extra?: Record<string, unknown>): CallToolResult {
  const body = extra ? { error: message, ...extra } : { error: message };
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
  };
}

const SECRET_PATTERNS = [
  /bearer\s+[a-z0-9._\-]+/gi,
  /api[_-]?key["'\s:=]+[^\s"',}]+/gi,
  /authorization["'\s:=]+[^\s"',}]+/gi,
];

/** Strip anything that looks like a credential before it reaches the model. */
export function scrub(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[redacted]');
  }
  return out.slice(0, 500);
}

/**
 * Map known virtuous-ts errors to a short message.
 * Never include the API key, request headers, or the raw axios error.
 */
export function failFromError(error: unknown): CallToolResult {
  if (error instanceof VirtuousQueryValidationError) {
    return fail('Query failed validation. Fix the issues and try again.', {
      issues: error.issues,
    });
  }

  if (error instanceof VirtuousRateLimitError) {
    const resetAt = error.status.resetAt ? error.status.resetAt.toISOString() : null;
    return fail(
      `Rate-limit reserve reached (${error.status.remaining ?? 0} remaining, reserve ${error.reserve}). Wait and retry. The request was not sent.`,
      { resetAt },
    );
  }

  if (error instanceof VirtuousApiError) {
    if (error.isNotFound) {
      return fail(scrub(error.message) || 'Not found.');
    }
    if (error.isUnauthorized) {
      return fail('Virtuous rejected the API key (401/403). Check the key and that the user can read this resource.');
    }
    if (error.isRateLimited) {
      return fail('Virtuous returned 429. The org shares 5,000 requests per hour. Wait for the window to reset.');
    }
    return fail(scrub(error.message || 'Virtuous API error.'));
  }

  if (error instanceof Error) {
    return fail(scrub(error.message || 'Unexpected error.'));
  }

  return fail('Unexpected error.');
}
