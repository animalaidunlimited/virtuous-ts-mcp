import { vi, type Mock } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { VirtuousReader } from '../src/lib/client-types.js';
import { createServer } from '../src/server.js';

type AsyncMock = Mock<(...args: never[]) => Promise<unknown>>;

function fn(): AsyncMock {
  return vi.fn() as AsyncMock;
}

/** A client whose every method is a vi.fn(). Nothing here can reach the network. */
export function fakeVirtuous(): VirtuousReader & {
  contact: VirtuousReader['contact'] & {
    findContactByEmailOrReference: AsyncMock;
    searchContacts: AsyncMock;
    getContactById: AsyncMock;
    queryAllContacts: AsyncMock;
    queryContactsWithFullDetails: AsyncMock;
    queryContactOptions: AsyncMock;
    getContactTypes: AsyncMock;
    getContactCustomFields: AsyncMock;
    getContactPrefixes: AsyncMock;
  };
  contactTag: {
    getTagsForContact: AsyncMock;
    listAllTagsFully: AsyncMock;
  };
  gift: VirtuousReader['gift'] & {
    getGiftsByContact: AsyncMock;
    queryAllGifts: AsyncMock;
    queryGiftsWithFullDetails: AsyncMock;
    getGiftQueryOptions: AsyncMock;
    getGiftCustomFields: AsyncMock;
    getNonCashGiftTypes: AsyncMock;
  };
  campaign: {
    queryCampaigns: AsyncMock;
    getCampaignSteps: AsyncMock;
    getCampaignQueryOptions: AsyncMock;
  };
  project: { getProjectQueryOptions: AsyncMock };
  recurringGift: { getRecurringGiftQueryOptions: AsyncMock };
  contactNote: { getContactNoteQueryOptions: AsyncMock };
  getRateLimitStatus: Mock;
  queryOptionsCache: {
    get: Mock;
  };
} {
  const cacheGet = vi.fn(async (_key: string, load: () => Promise<unknown>) => load());
  return {
    getRateLimitStatus: vi.fn(),
    queryOptionsCache: { get: cacheGet },
    contact: {
      findContactByEmailOrReference: fn(),
      searchContacts: fn(),
      getContactById: fn(),
      queryAllContacts: fn(),
      queryContactsWithFullDetails: fn(),
      queryContactOptions: fn(),
      getContactTypes: fn(),
      getContactCustomFields: fn(),
      getContactPrefixes: fn(),
    },
    contactTag: {
      getTagsForContact: fn(),
      listAllTagsFully: fn(),
    },
    gift: {
      getGiftsByContact: fn(),
      queryAllGifts: fn(),
      queryGiftsWithFullDetails: fn(),
      getGiftQueryOptions: fn(),
      getGiftCustomFields: fn(),
      getNonCashGiftTypes: fn(),
    },
    campaign: {
      queryCampaigns: fn(),
      getCampaignSteps: fn(),
      getCampaignQueryOptions: fn(),
    },
    project: { getProjectQueryOptions: fn() },
    recurringGift: { getRecurringGiftQueryOptions: fn() },
    contactNote: { getContactNoteQueryOptions: fn() },
  };
}

export type FakeVirtuous = ReturnType<typeof fakeVirtuous>;

export function serverWith(virtuous: VirtuousReader, maxRecords = 10_000): McpServer {
  return createServer(virtuous, maxRecords);
}

/** Pull the JSON object out of a tool result. */
export function jsonOf(result: CallToolResult): Record<string, unknown> {
  const block = result.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('expected a text content block');
  }
  return JSON.parse(block.text) as Record<string, unknown>;
}

export const GIFT_OPTIONS = {
  options: [
    {
      parameter: 'Gift Date',
      type: 'Date',
      operatorOptions: [
        { operator: 'GreaterThan', multipleValuesAllowed: false, valueRequired: true },
      ],
      valueOptions: [],
    },
    {
      parameter: 'Amount',
      type: 'Decimal',
      operatorOptions: [{ operator: 'GreaterThan', multipleValuesAllowed: false, valueRequired: true }],
      valueOptions: [],
    },
  ],
  operatorOptions: [],
};

export const CONTACT_OPTIONS = {
  options: [
    {
      parameter: 'Contact Id',
      type: 'Int',
      operatorOptions: [{ operator: 'Is', multipleValuesAllowed: false, valueRequired: true }],
      valueOptions: [],
    },
  ],
  operatorOptions: [],
};

export const validGiftQuery = {
  groups: [{ conditions: [{ parameter: 'Gift Date', operator: 'GreaterThan', value: '1/1/2024' }] }],
};

export const invalidGiftQuery = {
  groups: [{ conditions: [{ parameter: 'Gift date', operator: 'GreaterThan', value: '1/1/2024' }] }],
};
