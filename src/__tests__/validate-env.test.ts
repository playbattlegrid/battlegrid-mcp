import { describe, it, expect } from 'vitest';
import { validateEnv, DEFAULT_URL } from '../index.js';

describe('validateEnv', () => {
  it('returns config with valid API key and default URL', () => {
    const result = validateEnv({ BATTLEGRID_API_KEY: 'bg_live_abc123' });
    expect(result).toEqual({
      apiKey: 'bg_live_abc123',
      apiUrl: DEFAULT_URL,
    });
  });

  it('uses custom BATTLEGRID_API_URL when provided', () => {
    const result = validateEnv({
      BATTLEGRID_API_KEY: 'bg_live_abc123',
      BATTLEGRID_API_URL: 'http://localhost:4002/mcp',
    });
    expect(result.apiUrl).toBe('http://localhost:4002/mcp');
  });

  it('throws when BATTLEGRID_API_KEY is missing', () => {
    expect(() => validateEnv({})).toThrow('BATTLEGRID_API_KEY environment variable is required');
  });

  it('throws when BATTLEGRID_API_KEY is undefined', () => {
    expect(() => validateEnv({ BATTLEGRID_API_KEY: undefined })).toThrow(
      'BATTLEGRID_API_KEY environment variable is required'
    );
  });

  it('throws when BATTLEGRID_API_KEY is empty string', () => {
    expect(() => validateEnv({ BATTLEGRID_API_KEY: '' })).toThrow(
      'BATTLEGRID_API_KEY environment variable is required'
    );
  });

  it('throws when API key does not start with bg_live_', () => {
    expect(() => validateEnv({ BATTLEGRID_API_KEY: 'sk_test_abc' })).toThrow(
      'API key must start with "bg_live_"'
    );
  });

  it('throws when API key has wrong prefix casing', () => {
    expect(() => validateEnv({ BATTLEGRID_API_KEY: 'BG_LIVE_abc' })).toThrow(
      'API key must start with "bg_live_"'
    );
  });

  it('accepts minimum valid key (bg_live_ prefix only)', () => {
    const result = validateEnv({ BATTLEGRID_API_KEY: 'bg_live_x' });
    expect(result.apiKey).toBe('bg_live_x');
  });

  it('defaults to production URL when BATTLEGRID_API_URL is empty', () => {
    const result = validateEnv({
      BATTLEGRID_API_KEY: 'bg_live_abc123',
      BATTLEGRID_API_URL: '',
    });
    expect(result.apiUrl).toBe(DEFAULT_URL);
  });
});
