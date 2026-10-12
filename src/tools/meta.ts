import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VirtuousReader } from '../lib/client-types.js';
import { failFromError, ok } from '../lib/result.js';
import { READ_ONLY } from '../lib/tool-meta.js';

/**
 * Process-local rate-limit snapshot. Does not send a Virtuous request.
 * Null fields mean no response has been seen yet in this process.
 */
export function register(server: McpServer, virtuous: VirtuousReader): void {
  server.registerTool(
    'get_rate_limit_status',
    {
      title: 'Rate limit snapshot',
      description:
        'Read the latest Virtuous rate-limit headers seen by this process. Does not call the API. Use this before a large query_gifts or query_contacts. If remaining is near the reserve (default 50), stop and wait for resetAt. The org shares 5,000 requests per hour across every app.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const status = virtuous.getRateLimitStatus();
        return ok({
          limit: status.limit,
          remaining: status.remaining,
          resetAt: status.resetAt ? status.resetAt.toISOString() : null,
          lastUpdated: status.lastUpdated ? status.lastUpdated.toISOString() : null,
          requestsThisProcess: status.requestsThisProcess,
        });
      } catch (error) {
        return failFromError(error);
      }
    },
  );
}
