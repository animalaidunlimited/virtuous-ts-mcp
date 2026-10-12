import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildCampaignQuery } from 'virtuous-ts';
import type { VirtuousReader } from '../lib/client-types.js';
import { failFromError, ok } from '../lib/result.js';
import { READ_ONLY } from '../lib/tool-meta.js';
import { page } from '../lib/trim.js';

/**
 * Campaign tools. list_campaigns is a name filter over the campaign query.
 * Steps are the journey stages Virtuous stores on a campaign, not automations
 * (the API does not expose automations).
 */
export function register(server: McpServer, virtuous: VirtuousReader): void {
  server.registerTool(
    'list_campaigns',
    {
      title: 'List campaigns',
      description:
        'List campaigns, optionally filtered by a name fragment. Use this to find a campaign id before get_campaign_steps. Omit nameContains to list the first page. take is capped at 100. For field names on a custom campaign query, call get_query_options with resource Campaign.',
      inputSchema: {
        nameContains: z.string().min(1).optional().describe('Case-sensitive fragment of the campaign name.'),
        take: z.number().int().min(1).max(100).default(50).describe('How many campaigns to return. Default 50, max 100.'),
      },
      annotations: READ_ONLY,
    },
    async ({ nameContains, take }) => {
      try {
        // Virtuous treats an empty groups array as "no filter".
        // A name fragment uses the Campaign "Name" parameter via buildCampaignQuery.
        const query = nameContains ? buildCampaignQuery({ nameContains }) : { groups: [] };
        const result = await virtuous.campaign.queryCampaigns(query, { skip: 0, take });
        const records = result.list ?? [];
        return ok(page(records, result.total ?? records.length, (result.total ?? records.length) > records.length));
      } catch (error) {
        return failFromError(error);
      }
    },
  );

  server.registerTool(
    'get_campaign_steps',
    {
      title: 'Campaign steps',
      description:
        'List the step names for one campaign, in run order. Use after list_campaigns when you need the journey stages. This is not an automation log. The Virtuous API does not expose automations.',
      inputSchema: {
        campaignId: z.number().int().positive().describe('Virtuous campaign id.'),
      },
      annotations: READ_ONLY,
    },
    async ({ campaignId }) => {
      try {
        const steps = await virtuous.campaign.getCampaignSteps(campaignId);
        const records = (steps ?? []).map((name, index) => ({ order: index + 1, name }));
        return ok(page(records, records.length, false));
      } catch (error) {
        return failFromError(error);
      }
    },
  );
}
