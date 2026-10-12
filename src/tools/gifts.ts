import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryAll } from 'virtuous-ts';
import type { VirtuousReader } from '../lib/client-types.js';
import { failFromError, ok } from '../lib/result.js';
import { guardQuery } from '../lib/query-guard.js';
import { asQueryRequest, QueryRequestSchema } from '../lib/query-schema.js';
import { READ_ONLY } from '../lib/tool-meta.js';
import { page, shapeList } from '../lib/trim.js';

const giftSortBy = z.enum(['Id', 'GiftDate', 'Amount', 'Batch', 'CreatedDateTime']);

/**
 * Gift tools. get_gifts_by_contact is the common path.
 * query_gifts is for cross-contact filters (date, amount, project, segment).
 */
export function register(server: McpServer, virtuous: VirtuousReader, maxRecords: number): void {
  server.registerTool(
    'get_gifts_by_contact',
    {
      title: 'Gifts for one contact',
      description:
        'List gifts for one contact id. Use this when you already know the contact. Newest first by default. For gifts across many contacts (a date range, a project, an amount), use query_gifts after get_query_options with resource Gift. take is capped at 100.',
      inputSchema: {
        contactId: z.number().int().positive().describe('Virtuous contact id.'),
        take: z.number().int().min(1).max(100).default(25).describe('Page size. Default 25, max 100.'),
        sortBy: giftSortBy.optional().describe('Sort field. Default is the Virtuous default (usually GiftDate).'),
        descending: z.boolean().default(true).describe('Newest or largest first when true. Default true.'),
      },
      annotations: READ_ONLY,
    },
    async ({ contactId, take, sortBy, descending }) => {
      try {
        const result = await virtuous.gift.getGiftsByContact(contactId, {
          skip: 0,
          take,
          sortBy,
          descending,
        });
        const records = result.list ?? [];
        return ok(page(records, result.total ?? records.length, (result.total ?? records.length) > records.length));
      } catch (error) {
        return failFromError(error);
      }
    },
  );

  server.registerTool(
    'query_gifts',
    {
      title: 'Query gifts',
      description:
        'Run a structured gift query across contacts. Call get_query_options with resource Gift first and copy parameter names exactly (for example "Gift Date", not giftDate). Unknown parameters are rejected here and the query is not sent, because Virtuous would otherwise ignore them and return every gift. full=true returns full gift records. Above 200 rows the response is a summary (count, sum of amount, date range) plus the first 50.',
      inputSchema: {
        query: QueryRequestSchema.describe('Query body. Parameter names come from get_query_options.'),
        maxRecords: z
          .number()
          .int()
          .min(1)
          .max(maxRecords)
          .default(Math.min(1000, maxRecords))
          .describe(`Stop after this many rows. Hard cap is ${maxRecords}.`),
        full: z.boolean().default(false).describe('When true, page full gift records. Default is abbreviated.'),
      },
      annotations: READ_ONLY,
    },
    async ({ query, maxRecords: limit, full }) => {
      const request = asQueryRequest(query);
      const blocked = await guardQuery(request, () =>
        virtuous.queryOptionsCache
          ? virtuous.queryOptionsCache.get('Gift', () => virtuous.gift.getGiftQueryOptions())
          : virtuous.gift.getGiftQueryOptions(),
      );
      if (blocked) {
        return blocked;
      }
      try {
        const result = full
          ? await queryAll(
              (params) => virtuous.gift.queryGiftsWithFullDetails!(request, params),
              { maxRecords: limit },
            )
          : await virtuous.gift.queryAllGifts(request, { maxRecords: limit });
        return ok(shapeList(result.list, result.total, result.truncated));
      } catch (error) {
        return failFromError(error);
      }
    },
  );
}
