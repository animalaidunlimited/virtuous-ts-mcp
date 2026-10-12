import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VirtuousReader } from './lib/client-types.js';
import { register as registerCampaigns } from './tools/campaigns.js';
import { register as registerContacts } from './tools/contacts.js';
import { register as registerGifts } from './tools/gifts.js';
import { register as registerMeta } from './tools/meta.js';
import { register as registerReference } from './tools/reference.js';

export const SERVER_NAME = 'virtuous-ts-mcp';
export const SERVER_VERSION = '0.1.0';

/**
 * Build the MCP server and register the 12 read-only tools.
 *
 * The client is injected so tests can pass a fake. v0.1 never registers
 * write tools, even when the host set VIRTUOUS_ALLOW_WRITES. That flag is
 * logged in index.ts and ignored here on purpose.
 */
export function createServer(virtuous: VirtuousReader, maxRecords = 10_000): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerContacts(server, virtuous, maxRecords);
  registerGifts(server, virtuous, maxRecords);
  registerCampaigns(server, virtuous);
  registerReference(server, virtuous);
  registerMeta(server, virtuous);

  return server;
}
