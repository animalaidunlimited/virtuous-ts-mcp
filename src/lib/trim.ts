/** Drop empty values so the model does not spend context on null fields. */
export function dropNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(dropNulls);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === null || child === undefined || child === '') {
        continue;
      }
      out[key] = dropNulls(child);
    }
    return out;
  }
  return value;
}

const ARRAY_CAP = 8;

/**
 * Slim one record for the model: drop nulls, and cap nested arrays
 * (designations, individuals, custom fields) so one contact cannot fill the context.
 */
export function trimRecord(record: unknown): unknown {
  return capArrays(dropNulls(record));
}

function capArrays(value: unknown): unknown {
  if (Array.isArray(value)) {
    const sliced = value.slice(0, ARRAY_CAP).map(capArrays);
    if (value.length > ARRAY_CAP) {
      return [...sliced, { truncatedItems: value.length - ARRAY_CAP }];
    }
    return sliced;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = capArrays(child);
    }
    return out;
  }
  return value;
}

export interface PageShape {
  total: number;
  returned: number;
  truncated: boolean;
  records: unknown[];
}

/** Standard list envelope. `truncated` means the caller asked for more than we returned. */
export function page(records: unknown[], total: number, truncated = false): PageShape {
  return {
    total,
    returned: records.length,
    truncated,
    records: records.map(trimRecord),
  };
}

const SUMMARY_THRESHOLD = 200;
const SUMMARY_SAMPLE = 50;

export interface LargeListSummary {
  count: number;
  sumAmount: number | null;
  dateMin: string | null;
  dateMax: string | null;
  note: string;
}

/**
 * Above ~200 rows, a full dump wastes context and often hits the host limit.
 * Return a summary plus the first 50 trimmed rows. The model can narrow the query.
 */
export function shapeList(records: unknown[], total: number, truncated: boolean): PageShape | (PageShape & { summary: LargeListSummary }) {
  if (records.length <= SUMMARY_THRESHOLD) {
    return page(records, total, truncated);
  }
  const sample = records.slice(0, SUMMARY_SAMPLE);
  return {
    ...page(sample, total, true),
    summary: summarize(records),
  };
}

function summarize(records: unknown[]): LargeListSummary {
  let sum = 0;
  let sawAmount = false;
  let dateMin: string | null = null;
  let dateMax: string | null = null;

  for (const record of records) {
    if (!record || typeof record !== 'object') {
      continue;
    }
    const row = record as Record<string, unknown>;
    const amount = readAmount(row.amount);
    if (amount != null) {
      sum += amount;
      sawAmount = true;
    }
    const date = readDate(row.giftDate ?? row.createDateTimeUtc ?? row.lastGiftDate);
    if (date) {
      if (!dateMin || date < dateMin) dateMin = date;
      if (!dateMax || date > dateMax) dateMax = date;
    }
  }

  return {
    count: records.length,
    sumAmount: sawAmount ? roundMoney(sum) : null,
    dateMin,
    dateMax,
    note: `More than ${SUMMARY_THRESHOLD} rows. Showing the first ${SUMMARY_SAMPLE}. Narrow the query, or set full=false and a smaller maxRecords.`,
  };
}

function readAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
