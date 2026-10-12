import type { QueryRequest } from 'virtuous-ts';
import { z } from 'zod';

/**
 * One Virtuous query condition.
 * Parameter names are case-sensitive display names from QueryOptions
 * (for example "Gift Date", not "giftDate").
 */
export const ConditionSchema = z.object({
  parameter: z.string().min(1).describe('QueryOptions parameter name, case-sensitive.'),
  operator: z.string().min(1).describe('Operator from that parameter, for example Is or Contains.'),
  value: z.string().nullish().describe('Single comparison value. Omit for IsKnown.'),
  secondaryValue: z.string().nullish().describe('Upper bound for Between.'),
  values: z.array(z.string()).optional().describe('List values for IsAnyOf / IsNoneOf.'),
});

/**
 * Body posted to Virtuous Query endpoints.
 * At least one group, and each group needs at least one condition.
 */
export const QueryRequestSchema = z.object({
  groups: z
    .array(
      z.object({
        conditions: z.array(ConditionSchema).min(1),
      }),
    )
    .min(1),
  sortBy: z.string().optional().describe('QueryOptions parameter name to sort by.'),
  descending: z.boolean().optional(),
});

export type QueryRequestInput = z.infer<typeof QueryRequestSchema>;

/**
 * Zod keeps `operator` as a string so the model can pass any QueryOptions operator.
 * virtuous-ts types it as a known union. The strings are the same values.
 */
export function asQueryRequest(input: QueryRequestInput): QueryRequest {
  return input as QueryRequest;
}
