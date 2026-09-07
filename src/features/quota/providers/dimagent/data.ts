/**
 * DimAgent 额度数据层。React-free / SCSS-free。
 *
 * 用量接口 GET /api/me/usage 返回账户在本计费周期内的 "credits" 消耗与
 * 各功能额度（如 web_search 调用次数）。解析与行构造复用
 * @/utils/quota 的 parseDimagentUsagePayload / buildDimagentQuotaData；
 * 此层只负责取数与状态构造。
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, DimagentQuotaData, DimagentQuotaState } from '@/types';
import { apiCallApi, getApiCallErrorMessage } from '@/services/api';
import {
  DIMAGENT_USAGE_URL,
  DIMAGENT_REQUEST_HEADERS,
  createStatusError,
  isDimagentFile,
  isDisabledAuthFile,
  parseDimagentUsagePayload,
  buildDimagentQuotaData,
} from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

const fetchDimagentQuota = async (file: AuthFileItem, t: TFunction): Promise<DimagentQuotaData> => {
  const rawAuthIndex = file['auth_index'] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error(t('dimagent_quota.missing_auth_index'));
  }

  const result = await apiCallApi.request({
    authIndex,
    method: 'GET',
    url: DIMAGENT_USAGE_URL,
    header: { ...DIMAGENT_REQUEST_HEADERS },
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw createStatusError(getApiCallErrorMessage(result), result.statusCode);
  }

  const payload = parseDimagentUsagePayload(result.body ?? result.bodyText);
  if (!payload) {
    throw new Error(t('dimagent_quota.empty_data'));
  }

  const data = buildDimagentQuotaData(payload);
  if (data.rows.length === 0) {
    throw new Error(t('dimagent_quota.empty_data'));
  }
  return data;
};

export const DIMAGENT_CONFIG: QuotaProviderData<DimagentQuotaState, DimagentQuotaData> = {
  type: 'dimagent',
  i18nPrefix: 'dimagent_quota',
  filterFn: (file) => isDimagentFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchDimagentQuota,
  storeSelector: (state) => state.dimagentQuota,
  storeSetter: 'setDimagentQuota',
  buildLoadingState: () => ({ status: 'loading', rows: [] }),
  buildSuccessState: (data) => ({
    status: 'success',
    rows: data.rows,
    planName: data.planName,
  }),
  buildErrorState: (message, status) => ({
    status: 'error',
    rows: [],
    error: message,
    errorStatus: status,
  }),
};
