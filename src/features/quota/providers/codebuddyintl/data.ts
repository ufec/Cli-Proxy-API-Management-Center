/**
 * CodeBuddy Intl 额度数据层。React-free / SCSS-free。
 *
 * 计费接口在 www.workbuddy.ai（与 codebuddy-cn 同协议、不同端点与响应形状），POST
 * get-user-resource-summary 返回各资源包的 Cycle*Capacity 字符串字段，合计得出总额度/已用。
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, CodeBuddyIntlQuotaRow, CodeBuddyIntlQuotaState } from '@/types';
import { apiCallApi, getApiCallErrorMessage } from '@/services/api';
import {
  CODEBUDDY_INTL_BILLING_URL,
  CODEBUDDY_INTL_REQUEST_HEADERS,
  createStatusError,
  isCodeBuddyIntlFile,
  isDisabledAuthFile,
} from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

interface BillingPackage {
  PackageCode?: string;
  CapacityUnit?: string;
  CycleTotalCapacity?: string;
  CycleRemainCapacity?: string;
  CycleUsedCapacity?: string;
  CycleFrozenCapacity?: string;
}

interface BillingUserResourceSummaryBody {
  code?: number;
  msg?: string;
  data?: {
    Packages?: BillingPackage[];
  };
}

const parseCapacity = (value: string | undefined): number => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 0;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildCodeBuddyIntlQuotaRows = (packages: BillingPackage[]): CodeBuddyIntlQuotaRow[] =>
  packages.map((pkg, index) => {
    const unit = pkg.CapacityUnit || 'credits';
    const limit = parseCapacity(pkg.CycleTotalCapacity);
    const used = parseCapacity(pkg.CycleUsedCapacity) + parseCapacity(pkg.CycleFrozenCapacity);
    return {
      id: String(pkg.PackageCode ?? `package-${index}`),
      label: `${unit} #${index + 1}`,
      unit,
      used,
      limit,
    };
  });

const fetchCodeBuddyIntlQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<CodeBuddyIntlQuotaRow[]> => {
  const rawAuthIndex = file['auth_index'] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error(t('codebuddy_intl_quota.missing_auth_index'));
  }

  const result = await apiCallApi.request({
    authIndex,
    method: 'POST',
    url: CODEBUDDY_INTL_BILLING_URL,
    header: { ...CODEBUDDY_INTL_REQUEST_HEADERS },
    data: '{}',
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw createStatusError(getApiCallErrorMessage(result), result.statusCode);
  }

  const payload = (result.body ?? null) as BillingUserResourceSummaryBody | null;
  if (!payload || payload.code !== 0) {
    const message = payload?.msg ? `code=${payload.code} msg=${payload.msg}` : 'empty data';
    throw new Error(t('codebuddy_intl_quota.empty_data') + ` (${message})`);
  }

  const packages = payload.data?.Packages ?? [];
  const rows = buildCodeBuddyIntlQuotaRows(packages);
  if (rows.length === 0) {
    throw new Error(t('codebuddy_intl_quota.empty_data'));
  }
  return rows;
};

export const CODEBUDDY_INTL_CONFIG: QuotaProviderData<
  CodeBuddyIntlQuotaState,
  CodeBuddyIntlQuotaRow[]
> = {
  type: 'codebuddy-intl',
  i18nPrefix: 'codebuddy_intl_quota',
  filterFn: (file) => isCodeBuddyIntlFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchCodeBuddyIntlQuota,
  storeSelector: (state) => state.codebuddyIntlQuota,
  storeSetter: 'setCodebuddyIntlQuota',
  buildLoadingState: () => ({ status: 'loading', rows: [] }),
  buildSuccessState: (rows) => ({ status: 'success', rows }),
  buildErrorState: (message, status) => ({
    status: 'error',
    rows: [],
    error: message,
    errorStatus: status,
  }),
};
