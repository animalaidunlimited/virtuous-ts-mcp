import { describe, it } from 'vitest';

/**
 * Optional live smoke. Not part of `npm test`.
 * Run with `npm run test:live` only when VIRTUOUS_API_KEY is set in the environment.
 * This file stays skipped so a stray run cannot hit Virtuous.
 */
describe.skip('live smoke', () => {
  it('get_rate_limit_status and get_query_options Gift', () => {
    // Intentionally empty. v0.1 tests are mocked. Do not add a live runner here.
  });
});
