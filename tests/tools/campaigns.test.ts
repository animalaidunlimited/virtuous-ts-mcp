import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { fakeVirtuous, jsonOf, serverWith } from '../helpers.js';

async function call(name: string, args: Record<string, unknown>, virtuous = fakeVirtuous()) {
  const server = serverWith(virtuous);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  const result = await client.callTool({ name, arguments: args });
  return { result, virtuous };
}

describe('campaign tools', () => {
  it('list_campaigns filters with a Name Contains query', async () => {
    const virtuous = fakeVirtuous();
    virtuous.campaign.queryCampaigns.mockResolvedValue({
      list: [{ campaignId: 3, name: 'Year End', createdByUser: null }],
      total: 1,
    });
    const { result } = await call('list_campaigns', { nameContains: 'Year', take: 20 }, virtuous);
    expect(virtuous.campaign.queryCampaigns).toHaveBeenCalledWith(
      {
        groups: [{ conditions: [{ parameter: 'Name', operator: 'Contains', value: 'Year' }] }],
        sortBy: undefined,
        descending: undefined,
      },
      { skip: 0, take: 20 },
    );
    const body = jsonOf(result);
    expect(body).toMatchObject({ total: 1, returned: 1, truncated: false });
    expect((body.records as Record<string, unknown>[])[0]).not.toHaveProperty('createdByUser');
  });

  it('list_campaigns sends an empty query when no name is given', async () => {
    const virtuous = fakeVirtuous();
    virtuous.campaign.queryCampaigns.mockResolvedValue({ list: [], total: 0 });
    await call('list_campaigns', {}, virtuous);
    expect(virtuous.campaign.queryCampaigns).toHaveBeenCalledWith({ groups: [] }, { skip: 0, take: 50 });
  });

  it('get_campaign_steps numbers the step names', async () => {
    const virtuous = fakeVirtuous();
    virtuous.campaign.getCampaignSteps.mockResolvedValue(['Welcome', 'Ask']);
    const { result } = await call('get_campaign_steps', { campaignId: 3 }, virtuous);
    expect(virtuous.campaign.getCampaignSteps).toHaveBeenCalledWith(3);
    expect(jsonOf(result).records).toEqual([
      { order: 1, name: 'Welcome' },
      { order: 2, name: 'Ask' },
    ]);
  });
});
