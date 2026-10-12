import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('fails fast when VIRTUOUS_API_KEY is missing', () => {
    expect(() => loadConfig({})).toThrow(/VIRTUOUS_API_KEY is required/);
  });

  it('applies defaults and parses the write flag without enabling writes', () => {
    const config = loadConfig({ VIRTUOUS_API_KEY: 'test-key', VIRTUOUS_ALLOW_WRITES: 'true' });
    expect(config.apiKey).toBe('test-key');
    expect(config.baseURL).toBe('https://api.virtuoussoftware.com/api/');
    expect(config.maxRecords).toBe(10_000);
    expect(config.rateLimitReserve).toBe(50);
    expect(config.allowWrites).toBe(true);
  });
});
