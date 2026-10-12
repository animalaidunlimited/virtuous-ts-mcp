import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { fakeVirtuous, jsonOf } from './helpers.js';

const TOOL_NAMES = [
  'find_contact',
  'search_contacts',
  'get_contact',
  'get_contact_tags',
  'query_contacts',
  'get_gifts_by_contact',
  'query_gifts',
  'list_campaigns',
  'get_campaign_steps',
  'get_query_options',
  'get_reference_data',
  'get_rate_limit_status',
];

const WRITE_NAMES = ['add_contact_tag', 'create_contact_note', 'create_task', 'update_contact_safely'];

async function connect(allowWritesEnv?: string) {
  const previous = process.env.VIRTUOUS_ALLOW_WRITES;
  if (allowWritesEnv === undefined) {
    delete process.env.VIRTUOUS_ALLOW_WRITES;
  } else {
    process.env.VIRTUOUS_ALLOW_WRITES = allowWritesEnv;
  }
  const virtuous = fakeVirtuous();
  virtuous.getRateLimitStatus.mockReturnValue({
    limit: 5000,
    remaining: 100,
    resetAt: null,
    lastUpdated: null,
    requestsThisProcess: 0,
  });
  const server = createServer(virtuous);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  if (previous === undefined) {
    delete process.env.VIRTUOUS_ALLOW_WRITES;
  } else {
    process.env.VIRTUOUS_ALLOW_WRITES = previous;
  }
  return { client, virtuous };
}

describe('server', () => {
  it('lists exactly the 12 read-only tools, each with readOnlyHint', async () => {
    const { client } = await connect();
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    expect(names).toEqual([...TOOL_NAMES].sort());
    for (const tool of listed.tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.openWorldHint, tool.name).toBe(true);
      expect(tool.description?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('registers no write tools when VIRTUOUS_ALLOW_WRITES is unset', async () => {
    const { client } = await connect();
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    for (const writeName of WRITE_NAMES) {
      expect(names).not.toContain(writeName);
    }
  });

  it('registers no write tools when VIRTUOUS_ALLOW_WRITES=true', async () => {
    const { client } = await connect('true');
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toHaveLength(12);
    for (const writeName of WRITE_NAMES) {
      expect(names).not.toContain(writeName);
    }
  });

  it('round-trips get_rate_limit_status', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_rate_limit_status', arguments: {} });
    expect(result.isError).toBeUndefined();
    expect(jsonOf(result)).toMatchObject({ limit: 5000, remaining: 100, requestsThisProcess: 0 });
  });
});
