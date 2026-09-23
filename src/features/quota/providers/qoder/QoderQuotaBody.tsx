import { useTranslation } from 'react-i18next';
import type { QoderQuotaState } from '@/types';
import { formatDateValue } from '@/utils/format';
import { QuotaMeter } from '../../components/QuotaMeter';
import type { QuotaBodyProps } from '../../types';

const formatAmount = (value: number): string =>
  Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function QoderQuotaBody({ quota, classes }: QuotaBodyProps<QoderQuotaState>) {
  const { t, i18n } = useTranslation();
  if (quota.displayMode === 'enterprise') {
    return <div className={classes.quotaMessage}>{t('qoder_quota.enterprise')}</div>;
  }
  if (quota.rows.length === 0) {
    return <div className={classes.quotaMessage}>{t('qoder_quota.empty_data')}</div>;
  }
  return (
    <>
      {quota.userType && <div className={classes.quotaMessage}>{quota.userType}</div>}
      {quota.expiresAtMs && (
        <div className={classes.quotaMessage}>
          {t('qoder_quota.expires', { date: formatDateValue(quota.expiresAtMs, i18n.language) })}
        </div>
      )}
      {quota.rows.map((row, index) => {
        const percent =
          row.total > 0 ? Math.max(0, Math.min(100, (row.remaining / row.total) * 100)) : null;
        const label = ['user', 'addon', 'shared', 'dedicated'].includes(row.label)
          ? t(`qoder_quota.${row.label}`)
          : row.label;
        return (
          <div key={row.id} className={classes.quotaRow}>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>{label}</span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaReset}>
                  {t('qoder_quota.remaining', {
                    remaining: formatAmount(row.remaining),
                    total: formatAmount(row.total),
                    unit: row.unit,
                  })}
                </span>
                <span className={classes.quotaPercent}>
                  {percent === null ? '--' : `${Math.round(percent)}%`}
                </span>
              </div>
            </div>
            <QuotaMeter percent={percent} classes={classes} index={index} />
          </div>
        );
      })}
    </>
  );
}
