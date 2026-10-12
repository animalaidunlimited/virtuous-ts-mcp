#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VirtuousClient } from 'virtuous-ts';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

/**
 * Logs go to stderr. stdout is the MCP JSON-RPC channel.
 * A console.log here would break the host.
 */
function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.allowWrites) {
    log(
      'virtuous-ts-mcp: VIRTUOUS_ALLOW_WRITES is set, but v0.1 has no write tools. The client stays read-only.',
    );
  }

  // readOnly is a second lock: even a mistaken write call is rejected before send.
  // retry: {} opts into the library defaults (3 tries on 429/502/503/504).
  const virtuous = new VirtuousClient({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    readOnly: true,
    retry: {},
    rateLimitReserve: config.rateLimitReserve,
    validateQueries: true,
  });

  const server = createServer(virtuous, config.maxRecords);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`virtuous-ts-mcp ${'0.1.0'} listening on stdio (read-only).`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Failed to start';
  log(`virtuous-ts-mcp: ${message}`);
  process.exit(1);
});
