import {
  validateQuery,
  VirtuousQueryValidationError,
  type QueryOptionsResponse,
  type QueryRequest,
} from 'virtuous-ts';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { fail, failFromError } from './result.js';

/**
 * Load QueryOptions (the client cache when present) and check the body.
 *
 * Virtuous silently ignores unknown parameters and returns the whole table.
 * We fail here, with issues and suggestions, and never call the query method.
 */
export async function guardQuery(
  request: QueryRequest,
  loadOptions: () => Promise<QueryOptionsResponse>,
): Promise<CallToolResult | null> {
  let options: QueryOptionsResponse;
  try {
    options = await loadOptions();
  } catch (error) {
    return failFromError(error);
  }

  const issues = validateQuery(request, options);
  if (issues.length === 0) {
    return null;
  }

  // Reuse the library error so the message matches a validateQueries throw.
  const validation = new VirtuousQueryValidationError(issues);
  return fail(validation.message, { issues });
}

