import { describe, expect, test } from 'bun:test';
import {
  parseDimagentUsagePayload,
  buildDimagentQuotaData,
} from '@/utils/quota';

// Real payload shape captured from GET /api/me/usage (dimagent_usage.har).
const HAR_BODY = {
  success: true,
  data: {
    account_id: 1953,
    subscription: {
      product: { name: 'Lite套餐' },
    },
    credits: {
      total_credits: 11000,
      used_credits: 6970,
      remaining_credits: 4030,
      total_units: 11000,
      used_units: 6970,
      remaining_units: 4030,
      unlimited: false,
      subscription_bucket: {
        expires_at: '2026-09-21T06:57:54.686Z',
        hard_deadline_at: '2026-09-21T06:57:54.686Z',
      },
    },
    feature_meters: [
      {
        feature_key: 'web_search',
        unit: 'call',
        unlimited: false,
        total_allowance: 500,
        total_used: 7,
        total_remaining: 493,
        period_end: '2026-09-21T06:57:54.686Z',
      },
    ],
    credits_display: { enabled: true, credit_name: 'Credits', decimals: 0 },
  },
};

const TERM_END_MS = Date.parse('2026-09-21T06:57:54.686Z');

describe('parseDimagentUsagePayload', () => {
  test('extracts the inner data object from the wrapped response', () => {
    const data = parseDimagentUsagePayload(HAR_BODY);
    expect(data).not.toBeNull();
    expect(data?.credits?.used_credits).toBe(6970);
    expect(data?.feature_meters?.[0]?.feature_key).toBe('web_search');
  });

  test('accepts a JSON string body', () => {
    const data = parseDimagentUsagePayload(JSON.stringify(HAR_BODY));
    expect(data?.credits?.total_credits).toBe(11000);
  });

  test('returns null when success is false', () => {
    expect(parseDimagentUsagePayload({ success: false, data: HAR_BODY.data })).toBeNull();
  });

  test('returns null for empty / malformed input', () => {
    expect(parseDimagentUsagePayload(null)).toBeNull();
    expect(parseDimagentUsagePayload('')).toBeNull();
    expect(parseDimagentUsagePayload('not-json')).toBeNull();
    expect(parseDimagentUsagePayload({})).toBeNull();
  });
});

describe('buildDimagentQuotaData', () => {
  test('builds the main credits row plus the web_search meter from real data', () => {
    const data = buildDimagentQuotaData(HAR_BODY.data);

    expect(data.planName).toBe('Lite套餐');
    expect(data.rows.map((row) => row.id)).toEqual(['credits', 'web_search']);

    const [credits, webSearch] = data.rows;
    expect(credits).toMatchObject({
      label: 'Credits',
      used: 6970,
      limit: 11000,
      resetAtMs: TERM_END_MS,
    });
    expect(webSearch).toMatchObject({
      label: 'web_search',
      used: 7,
      limit: 500,
      resetAtMs: TERM_END_MS,
    });
  });

  test('falls back to *_units when *_credits are absent', () => {
    const data = buildDimagentQuotaData({
      credits: { total_units: 100, used_units: 25 },
    });
    expect(data.rows[0]).toMatchObject({ used: 25, limit: 100 });
  });

  test('skips feature meters without a finite allowance (e.g. unlimited grants)', () => {
    const data = buildDimagentQuotaData({
      feature_meters: [
        { feature_key: 'unlimited_thing', unlimited: true },
        { feature_key: 'web_search', total_allowance: 500, total_used: 7 },
      ],
    });
    expect(data.rows.map((row) => row.id)).toEqual(['web_search']);
  });

  test('defaults the credits label to "Credits" when credit_name is missing', () => {
    const data = buildDimagentQuotaData({ credits: { total_credits: 10, used_credits: 1 } });
    expect(data.rows[0]?.label).toBe('Credits');
    expect(data.planName).toBeNull();
  });

  test('returns no rows when there is neither credits nor finite meters', () => {
    const data = buildDimagentQuotaData({ feature_meters: [{ unlimited: true }] });
    expect(data.rows).toEqual([]);
  });
});
