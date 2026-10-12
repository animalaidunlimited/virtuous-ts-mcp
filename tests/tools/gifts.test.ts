import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  GIFT_OPTIONS,
  fakeVirtuous,
  invalidGiftQuery,
  jsonOf,
  serverWith,
  validGiftQuery,
} from '../helpers.js';

async function call(name: string, args: Record<string, unknown>, virtuous = fakeVirtuous()) {
  const server = serverWith(virtuous);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  const result = await client.callTool({ name, arguments: args });
  return { result, virtuous };
}

describe('gift tools', () => {
  it('get_gifts_by_contact passes sort and a default descending flag', async () => {
    const virtuous = fakeVirtuous();
    virtuous.gift.getGiftsByContact.mockResolvedValue({
      list: [{ id: 1, amount: '25.00', giftDate: '2024-01-02', notes: null }],
      total: 3,
    });
    const { result } = await call('get_gifts_by_contact', { contactId: 4, take: 10, sortBy: 'Amount' }, virtuous);
    expect(virtuous.gift.getGiftsByContact).toHaveBeenCalledWith(4, {
      skip: 0,
      take: 10,
      sortBy: 'Amount',
      descending: true,
    });
    const body = jsonOf(result);
    expect(body).toMatchObject({ total: 3, returned: 1, truncated: true });
    expect((body.records as Record<string, unknown>[])[0]).not.toHaveProperty('notes');
  });

  it('query_gifts returns isError and does not call the query when validation fails', async () => {
    const virtuous = fakeVirtuous();
    virtuous.gift.getGiftQueryOptions.mockResolvedValue(GIFT_OPTIONS);
    const { result } = await call('query_gifts', { query: invalidGiftQuery }, virtuous);
    expect(result.isError).toBe(true);
    const body = jsonOf(result);
    expect(body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unknown-parameter',
          parameter: 'Gift date',
          suggestion: 'Gift Date',
        }),
      ]),
    );
    expect(virtuous.gift.queryAllGifts).not.toHaveBeenCalled();
    expect(virtuous.gift.queryGiftsWithFullDetails).not.toHaveBeenCalled();
  });

  it('query_gifts reports a truncated queryAll result', async () => {
    const virtuous = fakeVirtuous();
    virtuous.gift.getGiftQueryOptions.mockResolvedValue(GIFT_OPTIONS);
    virtuous.gift.queryAllGifts.mockResolvedValue({
      list: [{ id: 1, amount: '10', giftDate: '2024-02-01' }],
      total: 5000,
      truncated: true,
    });
    const { result } = await call('query_gifts', { query: validGiftQuery, maxRecords: 1 }, virtuous);
    expect(virtuous.gift.queryAllGifts).toHaveBeenCalledWith(validGiftQuery, { maxRecords: 1 });
    expect(jsonOf(result)).toMatchObject({ total: 5000, returned: 1, truncated: true });
  });

  it('summarizes more than 200 gifts and returns only the first 50', async () => {
    const virtuous = fakeVirtuous();
    virtuous.gift.getGiftQueryOptions.mockResolvedValue(GIFT_OPTIONS);
    const list = Array.from({ length: 220 }, (_, index) => ({
      id: index + 1,
      amount: '10.50',
      giftDate: index === 0 ? '2020-01-01' : '2024-06-15',
    }));
    virtuous.gift.queryAllGifts.mockResolvedValue({ list, total: 220, truncated: false });
    const { result } = await call('query_gifts', { query: validGiftQuery }, virtuous);
    const body = jsonOf(result);
    expect(body.returned).toBe(50);
    expect(body.truncated).toBe(true);
    expect(body.total).toBe(220);
    expect(body.summary).toMatchObject({
      count: 220,
      sumAmount: 2310,
      dateMin: '2020-01-01',
      dateMax: '2024-06-15',
    });
  });

  it('uses the cache key Gift before calling queryAllGifts', async () => {
    const virtuous = fakeVirtuous();
    virtuous.gift.getGiftQueryOptions.mockResolvedValue(GIFT_OPTIONS);
    virtuous.gift.queryAllGifts.mockResolvedValue({ list: [], total: 0, truncated: false });
    await call('query_gifts', { query: validGiftQuery }, virtuous);
    expect(virtuous.queryOptionsCache.get).toHaveBeenCalledWith('Gift', expect.any(Function));
  });
});
