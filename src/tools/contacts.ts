import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listAll, queryAll } from 'virtuous-ts';
import type { VirtuousReader } from '../lib/client-types.js';
import { fail, failFromError, ok } from '../lib/result.js';
import { guardQuery } from '../lib/query-guard.js';
import { asQueryRequest, QueryRequestSchema } from '../lib/query-schema.js';
import { READ_ONLY } from '../lib/tool-meta.js';
import { page, shapeList, trimRecord } from '../lib/trim.js';

/**
 * Contact tools. Prefer the narrow lookup (find / get) over a query.
 * query_contacts is for filters the other tools cannot express.
 */
export function register(server: McpServer, virtuous: VirtuousReader, maxRecords: number): void {
  server.registerTool(
    'find_contact',
    {
      title: 'Find a contact',
      description:
        'Find one contact by email, or by reference source plus reference id. Use this before get_contact when you do not already have a Virtuous contact id. Provide email, or both referenceSource and referenceId. Do not use this for a name search; use search_contacts.',
      inputSchema: {
        email: z.string().email().optional().describe('Contact email address.'),
        referenceSource: z.string().min(1).optional().describe('External system name, for example a form name.'),
        referenceId: z.string().min(1).optional().describe('Id in that external system.'),
      },
      annotations: READ_ONLY,
    },
    async ({ email, referenceSource, referenceId }) => {
      const hasRef = Boolean(referenceSource && referenceId);
      if (!email && !hasRef) {
        return fail('Provide email, or both referenceSource and referenceId.');
      }
      if ((referenceSource && !referenceId) || (!referenceSource && referenceId)) {
        return fail('referenceSource and referenceId must be sent together.');
      }
      try {
        const contact = await virtuous.contact.findContactByEmailOrReference({
          email,
          referenceSource,
          referenceId,
        });
        return ok(trimRecord(contact));
      } catch (error) {
        return failFromError(error);
      }
    },
  );

  server.registerTool(
    'search_contacts',
    {
      title: 'Search contacts by text',
      description:
        'Free-text search across contact names. Use when you have a name or fragment and no email or contact id. For structured filters (city, gift history, custom fields) use query_contacts after get_query_options with resource Contact. take is capped at 50.',
      inputSchema: {
        text: z.string().min(2).describe('Name or fragment, at least 2 characters.'),
        take: z.number().int().min(1).max(50).default(10).describe('How many matches to return. Default 10, max 50.'),
      },
      annotations: READ_ONLY,
    },
    async ({ text, take }) => {
      try {
        const result = await virtuous.contact.searchContacts({ search: text }, { skip: 0, take });
        const records = result.list ?? [];
        return ok(page(records, result.total ?? records.length, (result.total ?? records.length) > records.length));
      } catch (error) {
        return failFromError(error);
      }
    },
  );

  server.registerTool(
    'get_contact',
    {
      title: 'Get a contact by id',
      description:
        'Load one contact by Virtuous contact id, including individuals, address, and giving totals. Use after find_contact or search_contacts. For tags use get_contact_tags. For gifts use get_gifts_by_contact.',
      inputSchema: {
        contactId: z.number().int().positive().describe('Virtuous contact id.'),
      },
      annotations: READ_ONLY,
    },
    async ({ contactId }) => {
      try {
        const contact = await virtuous.contact.getContactById(contactId);
        return ok(trimRecord(contact));
      } catch (error) {
        return failFromError(error);
      }
    },
  );

  server.registerTool(
    'get_contact_tags',
    {
      title: 'List tags on a contact',
      description:
        'List every tag applied to a contact. Pages until the list ends. Use when you need tag names for a known contact id. To browse the org tag catalog, use get_reference_data with kind tags.',
      inputSchema: {
        contactId: z.number().int().positive().describe('Virtuous contact id.'),
      },
      annotations: READ_ONLY,
    },
    async ({ contactId }) => {
      try {
        const all = await listAll((params) => virtuous.contactTag.getTagsForContact(contactId, params));
        return ok(page(all.list, all.total, all.truncated));
      } catch (error) {
        return failFromError(error);
      }
    },
  );

  server.registerTool(
    'query_contacts',
    {
      title: 'Query contacts',
      description:
        'Run a structured contact query. Call get_query_options with resource Contact first and copy parameter and operator names exactly. Unknown parameters are rejected here and the query is not sent. Use search_contacts for a name, find_contact for an email. full=true asks for full contact records (heavier). Above 200 rows the response is a summary plus the first 50.',
      inputSchema: {
        query: QueryRequestSchema.describe('Query body. Parameter names come from get_query_options.'),
        maxRecords: z
          .number()
          .int()
          .min(1)
          .max(maxRecords)
          .default(Math.min(1000, maxRecords))
          .describe(`Stop after this many rows. Hard cap is ${maxRecords}.`),
        full: z.boolean().default(false).describe('When true, request full contact records. Default is abbreviated.'),
      },
      annotations: READ_ONLY,
    },
    async ({ query, maxRecords: limit, full }) => {
      const request = asQueryRequest(query);
      const blocked = await guardQuery(request, () =>
        virtuous.queryOptionsCache
          ? virtuous.queryOptionsCache.get('Contact', () => virtuous.contact.queryContactOptions())
          : virtuous.contact.queryContactOptions(),
      );
      if (blocked) {
        return blocked;
      }
      try {
        // Abbreviated paging is queryAllContacts. Full records have no queryAll*
        // helper, so page queryContactsWithFullDetails with the shared queryAll.
        const result = full
          ? await queryAll(
              (params) => virtuous.contact.queryContactsWithFullDetails!(request, params),
              { maxRecords: limit },
            )
          : await virtuous.contact.queryAllContacts(request, { maxRecords: limit });
        return ok(shapeList(result.list, result.total, result.truncated));
      } catch (error) {
        return failFromError(error);
      }
    },
  );
}
