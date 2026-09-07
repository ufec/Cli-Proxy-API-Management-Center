/**
 * DimAgent 额度渲染体：账户用量水位条（GET /api/me/usage）。
 * 顶部展示套餐名；每行一个额度（主 credits + 各功能额度），
 * 次行展示 used / limit 与周期重置日期。
 * 仅复用既有 QuotaBody 契约类名与 QuotaMeter 水位条，不新增样式。
 */

import { useTranslation } from 'react-i18next';
import type { DimagentQuotaState } from '@/types';
import { formatDateValue } from '@/utils/format';
import { QuotaMeter } from '../../components/QuotaMeter';
import type { QuotaBodyProps } from '../../types';

const fmtNumber = (value: number): string =>
  Number.isFinite(value) ? Math.round(value).toLocaleString() : '0';

export function DimagentQuotaBody({ quota, classes }: QuotaBodyProps<DimagentQuotaState>) {
  const { t, i18n } = useTranslation();
  const rows = quota.rows ?? [];

  if (rows.length === 0) {
    return <div className={classes.quotaMessage}>{t('dimagent_quota.empty_data')}</div>;
  }

  return (
    <>
      {quota.planName ? <div className={classes.quotaMessage}>{quota.planName}</div> : null}
      {rows.map((row, index) => {
        const displayLabel =
          row.id === 'credits'
            ? row.label
            : t(`dimagent_quota.feature_${row.id}`, { defaultValue: row.label });
        const remaining =
          row.limit > 0
            ? Math.max(0, Math.min(100, Math.round(((row.limit - row.used) / row.limit) * 100)))
            : row.used > 0
              ? 0
              : null;
        const percentLabel = remaining === null ? '--' : `${remaining}%`;
        const usageLabel = `${fmtNumber(row.used)} / ${fmtNumber(row.limit)}`;
        const resetLabel =
          row.resetAtMs && row.resetAtMs > 0
            ? t('dimagent_quota.reset', { date: formatDateValue(row.resetAtMs, i18n.language) })
            : '';

        return (
          <div key={row.id} className={classes.quotaRow} title={usageLabel}>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>{displayLabel}</span>
              <div className={classes.quotaMeta}>
                {usageLabel && <span className={classes.quotaReset}>{usageLabel}</span>}
                <span className={classes.quotaPercent}>{percentLabel}</span>
              </div>
            </div>
            <QuotaMeter percent={remaining} classes={classes} index={index} />
            {resetLabel && (
              <div className={classes.quotaMeta}>
                <span className={classes.quotaReset}>{resetLabel}</span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
