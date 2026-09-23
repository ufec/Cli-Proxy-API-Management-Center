import type { TFunction } from 'i18next';
import type { AuthFileItem, QoderQuotaData, QoderQuotaRow, QoderQuotaState } from '@/types';
import { qoderApi } from '@/services/api';
import { normalizeAuthIndex } from '@/utils/authIndex';
import { isDisabledAuthFile, isQoderFile } from '@/utils/quota';
import type { QuotaProviderData } from '../types';

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const timestampMs = (value: unknown): number | null => {
  const stamp = finite(value);
  if (stamp === null || stamp === 0) return null;
  return stamp < 1e12 ? stamp * 1000 : stamp;
};

const quotaRow = (value: unknown, id: string, label: string): QoderQuotaRow | null => {
  const quota = record(value);
  if (!quota) return null;
  const total = finite(quota.total) ?? finite(quota.cap);
  const used = finite(quota.used);
  const remaining = finite(quota.remaining);
  if (total === null || (used === null && remaining === null)) return null;
  const resolvedUsed = used ?? Math.max(0, total - (remaining ?? 0));
  return {
    id,
    label,
    total,
    used: resolvedUsed,
    remaining: remaining ?? Math.max(0, total - resolvedUsed),
    unit: text(quota.unit) ?? 'credits',
  };
};

// The desktop client validates displayMode and qoderUsage before normalizing
// these quota buckets. Keep the same distinction between account and enterprise.
export const parseQoderUsage = (input: unknown): QoderQuotaData | null => {
  const payload = record(input);
  if (!payload) return null;
  if (payload.displayMode === 'enterprise') {
    return { displayMode: 'enterprise', userType: null, expiresAtMs: null, rows: [] };
  }
  if (payload.displayMode !== 'qoder') return null;
  const usage = record(payload.qoderUsage);
  if (!usage) return null;
  const rows: QoderQuotaRow[] = [];
  const push = (row: QoderQuotaRow | null) => {
    if (row) rows.push(row);
  };
  push(quotaRow(usage.userQuota ?? usage.user_quota, 'user', 'user'));
  push(quotaRow(usage.addOnQuota ?? usage.add_on_quota, 'addon', 'addon'));
  push(quotaRow(usage.orgResourcePackage ?? usage.org_resource_package, 'shared', 'shared'));
  const dedicated = usage.dedicatedResourcePackages ?? usage.dedicated_resource_packages;
  if (Array.isArray(dedicated)) {
    dedicated.forEach((item, index) => {
      const details = record(item);
      if (!details) return;
      push(
        quotaRow(
          details,
          text(details.id) ?? `dedicated-${index}`,
          text(details.name) ?? 'dedicated'
        )
      );
    });
  }
  return {
    displayMode: 'qoder',
    userType: text(usage.userType ?? usage.user_type),
    expiresAtMs: timestampMs(usage.expiresAt ?? usage.expires_at),
    rows,
  };
};

const fetchQoderQuota = async (file: AuthFileItem, t: TFunction): Promise<QoderQuotaData> => {
  const authIndex = normalizeAuthIndex(file['auth_index'] ?? file.authIndex);
  if (!authIndex) throw new Error(t('qoder_quota.missing_auth_index'));
  const data = parseQoderUsage(await qoderApi.usage(authIndex));
  if (!data) throw new Error(t('qoder_quota.empty_data'));
  return data;
};

export const QODER_CONFIG: QuotaProviderData<QoderQuotaState, QoderQuotaData> = {
  type: 'qoder',
  i18nPrefix: 'qoder_quota',
  filterFn: (file) => isQoderFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchQoderQuota,
  storeSelector: (state) => state.qoderQuota,
  storeSetter: 'setQoderQuota',
  buildLoadingState: () => ({
    status: 'loading',
    displayMode: 'qoder',
    userType: null,
    expiresAtMs: null,
    rows: [],
  }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    displayMode: 'qoder',
    userType: null,
    expiresAtMs: null,
    rows: [],
    error: message,
    errorStatus: status,
  }),
};
