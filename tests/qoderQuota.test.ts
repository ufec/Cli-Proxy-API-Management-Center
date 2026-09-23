import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { parseQoderUsage } from '@/features/quota/providers/qoder/data';
import { QoderQuotaBody } from '@/features/quota/providers/qoder/QoderQuotaBody';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import en from '@/i18n/locales/en.json';

const i18n = createInstance();
await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'qoder-test'
);

describe('Qoder usage normalization', () => {
  test('reads account, add-on, shared, and dedicated credits', () => {
    const result = parseQoderUsage({
      displayMode: 'qoder',
      qoderUsage: {
        userType: 'pro',
        expiresAt: 1790120000,
        userQuota: { total: 100, used: 25, unit: 'credits' },
        addOnQuota: { total: 20, used: 5 },
        orgResourcePackage: { cap: 50, used: 10 },
        dedicatedResourcePackages: [{ id: 'pack-1', name: 'Dedicated', total: 30, used: 12 }],
      },
    });
    expect(result?.userType).toBe('pro');
    expect(result?.expiresAtMs).toBe(1790120000000);
    expect(result?.rows.map((row) => row.remaining)).toEqual([75, 15, 40, 18]);
  });

  test('supports enterprise mode without inventing quota numbers', () => {
    expect(parseQoderUsage({ displayMode: 'enterprise', enterpriseUsage: {} })).toEqual({
      displayMode: 'enterprise',
      userType: null,
      expiresAtMs: null,
      rows: [],
    });
  });

  test('rejects unknown payloads', () => {
    expect(parseQoderUsage({ displayMode: 'qoder' })).toBeNull();
    expect(parseQoderUsage({ displayMode: 'unknown' })).toBeNull();
  });

  test('renders remaining account credits without exposing tokens', () => {
    const data = parseQoderUsage({
      displayMode: 'qoder',
      qoderUsage: { userType: 'pro', userQuota: { total: 100, used: 25 } },
    });
    if (!data) throw new Error('missing usage');
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(QoderQuotaBody, { quota: { status: 'success', ...data }, classes })
      )
    );
    expect(markup).toContain('Account credits');
    expect(markup).toContain('75 / 100 credits remaining');
    expect(markup).toContain('75%');
  });
});
