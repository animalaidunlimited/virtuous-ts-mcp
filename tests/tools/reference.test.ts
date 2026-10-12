import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { GIFT_OPTIONS, fakeVirtuous, jsonOf, serverWith } from '../helpers.js';

async function call(name: string, args: Record<string, unknown>, virtuous = fakeVirtuous()) {
  const server = serverWith(virtuous);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  const result = await client.callTool({ name, arguments: args });
  return { result, virtuous };
}

describe('reference and meta tools', () => {
  it('get_query_options loads Gift options through the cache', async () => {
    const virtuous = fakeVirtuous();
    virtuous.gift.getGiftQueryOptions.mockResolvedValue(GIFT_OPTIONS);
    const { result } = await call('get_query_options', { resource: 'Gift' }, virtuous);
    expect(virtuous.queryOptionsCache.get).toHaveBeenCalledWith('Gift', expect.any(Function));
    expect(jsonOf(result)).toMatchObject({ resource: 'Gift', parameterCount: 2 });
  });

  it('get_reference_data kind tags uses listAllTagsFully', async () => {
    const virtuous = fakeVirtuous();
    virtuous.contactTag.listAllTagsFully.mockResolvedValue({
      list: [{ id: 1, tagName: 'Donor' }],
      total: 1,
      truncated: false,
    });
    const { result } = await call('get_reference_data', { kind: 'tags' }, virtuous);
    expect(virtuous.contactTag.listAllTagsFully).toHaveBeenCalled();
    expect(jsonOf(result)).toMatchObject({ kind: 'tags', total: 1, returned: 1 });
  });

  it('get_reference_data kind prefixes notes the 10-row catalog limit', async () => {
    const virtuous = fakeVirtuous();
    virtuous.contact.getContactPrefixes.mockResolvedValue(['Dr', 'Ms']);
    const { result } = await call('get_reference_data', { kind: 'prefixes' }, virtuous);
    const body = jsonOf(result);
    expect(body.records).toEqual(['Dr', 'Ms']);
    expect(String(body.note)).toMatch(/first 10/);
  });

  it('get_reference_data kind nonCashGiftTypes pages with skip and take', async () => {
    const virtuous = fakeVirtuous();
    virtuous.gift.getNonCashGiftTypes.mockResolvedValue({
      list: [{ id: 1, name: 'Stock', isEnabled: true }],
      total: 1,
    });
    const { result } = await call('get_reference_data', { kind: 'nonCashGiftTypes' }, virtuous);
    const first = virtuous.gift.getNonCashGiftTypes.mock.calls[0] as unknown[];
    expect(first[0]).toMatchObject({ skip: 0, take: expect.any(Number) });
    expect(jsonOf(result)).toMatchObject({ kind: 'nonCashGiftTypes', returned: 1 });
  });

  it('get_rate_limit_status does not call a query method', async () => {
    const virtuous = fakeVirtuous();
    virtuous.getRateLimitStatus.mockReturnValue({
      limit: 5000,
      remaining: 4900,
      resetAt: new Date('2026-01-01T00:00:00.000Z'),
      lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
      requestsThisProcess: 2,
    });
    const { result } = await call('get_rate_limit_status', {}, virtuous);
    expect(jsonOf(result)).toMatchObject({
      limit: 5000,
      remaining: 4900,
      resetAt: '2026-01-01T00:00:00.000Z',
      requestsThisProcess: 2,
    });
    expect(virtuous.gift.queryAllGifts).not.toHaveBeenCalled();
  });
});
