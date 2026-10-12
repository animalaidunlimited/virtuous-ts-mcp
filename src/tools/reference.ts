import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listAll } from 'virtuous-ts';
import type { VirtuousReader } from '../lib/client-types.js';
import { failFromError, ok } from '../lib/result.js';
import { READ_ONLY } from '../lib/tool-meta.js';
import { page } from '../lib/trim.js';

const RESOURCES = ['Contact', 'Gift', 'Campaign', 'Project', 'RecurringGift', 'ContactNote'] as const;

/**
 * Catalog tools. Call get_query_options before query_gifts or query_contacts.
 * get_reference_data is for tags, types, custom fields, and prefixes.
 */
export function register(server: McpServer, virtuous: VirtuousReader): void {
  server.registerTool(
    'get_query_options',
    {
      title: 'Query field catalog',
      description:
        'Load the parameter names, operators, and allowed values for a Virtuous query resource. Call this before query_gifts or query_contacts, and copy parameter names exactly. Results are cached for one hour on the client when a cache is present. resource is one of Contact, Gift, Campaign, Project, RecurringGift, ContactNote.',
      inputSchema: {
        resource: z.enum(RESOURCES).describe('Which QueryOptions catalog to load.'),
      },
      annotations: READ_ONLY,
    },
    async ({ resource }) => {
      try {
        const options = await loadQueryOptions(virtuous, resource);
        return ok({
          resource,
          parameterCount: options.options?.length ?? 0,
          parameters: options.options ?? [],
        });
      } catch (error) {
        return failFromError(error);
      }
    },
  );

  server.registerTool(
    'get_reference_data',
    {
      title: 'Reference catalogs',
      description:
        'Load a small Virtuous catalog. kind tags pages the tag catalog. contactTypes, contactCustomFields, giftCustomFields, and prefixes are plain arrays (Virtuous may return only the first 10). nonCashGiftTypes is paged. Use tags to find a tag name. Use custom field kinds before you filter on a custom field in a query.',
      inputSchema: {
        kind: z
          .enum([
            'tags',
            'contactTypes',
            'contactCustomFields',
            'giftCustomFields',
            'prefixes',
            'nonCashGiftTypes',
          ])
          .describe('Which catalog to load.'),
      },
      annotations: READ_ONLY,
    },
    async ({ kind }) => {
      try {
        return ok(await loadReference(virtuous, kind));
      } catch (error) {
        return failFromError(error);
      }
    },
  );
}

async function loadQueryOptions(virtuous: VirtuousReader, resource: (typeof RESOURCES)[number]) {
  const loaders = {
    Contact: () => virtuous.contact.queryContactOptions(),
    Gift: () => virtuous.gift.getGiftQueryOptions(),
    Campaign: () => virtuous.campaign.getCampaignQueryOptions(),
    Project: () => virtuous.project.getProjectQueryOptions(),
    RecurringGift: () => virtuous.recurringGift.getRecurringGiftQueryOptions(),
    ContactNote: () => virtuous.contactNote.getContactNoteQueryOptions(),
  } as const;

  const load = loaders[resource];
  if (virtuous.queryOptionsCache) {
    return virtuous.queryOptionsCache.get(resource, load);
  }
  return load();
}

async function loadReference(
  virtuous: VirtuousReader,
  kind:
    | 'tags'
    | 'contactTypes'
    | 'contactCustomFields'
    | 'giftCustomFields'
    | 'prefixes'
    | 'nonCashGiftTypes',
) {
  if (kind === 'tags') {
    const all = await virtuous.contactTag.listAllTagsFully();
    return { kind, ...page(all.list, all.total, all.truncated) };
  }

  if (kind === 'nonCashGiftTypes') {
    // The client method requires skip/take. listAll supplies both.
    const all = await listAll((params) => virtuous.gift.getNonCashGiftTypes(params));
    return { kind, ...page(all.list, all.total, all.truncated) };
  }

  if (kind === 'contactTypes') {
    const list = await virtuous.contact.getContactTypes();
    return plainCatalog(kind, list, 'Contact types are a plain array. Virtuous may return only the first 10.');
  }
  if (kind === 'contactCustomFields') {
    const list = await virtuous.contact.getContactCustomFields();
    return plainCatalog(kind, list, 'Contact custom fields are a plain array. Virtuous may return only the first 10.');
  }
  if (kind === 'giftCustomFields') {
    const list = await virtuous.gift.getGiftCustomFields();
    return plainCatalog(kind, list, 'Gift custom fields are a plain array. Virtuous may return only the first 10.');
  }

  const prefixes = await virtuous.contact.getContactPrefixes();
  return plainCatalog('prefixes', prefixes, 'Prefixes are a plain array. Virtuous may return only the first 10.');
}

function plainCatalog(kind: string, list: unknown[] | null | undefined, note: string) {
  const records = list ?? [];
  return {
    kind,
    note,
    ...page(records, records.length, false),
  };
}

