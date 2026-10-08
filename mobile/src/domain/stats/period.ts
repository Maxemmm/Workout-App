// Période des stats (réglage statsPeriod)
import { addDays } from './dates';

export const STATS_PERIODS = ['4w', '3m', '1y', 'all'] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];
export const DEFAULT_STATS_PERIOD: StatsPeriod = '3m';

const PERIOD_DAYS: Record<Exclude<StatsPeriod, 'all'>, number> = { '4w': 28, '3m': 91, '1y': 365 };

export function isStatsPeriod(v: unknown): v is StatsPeriod {
  return typeof v === 'string' && (STATS_PERIODS as readonly string[]).includes(v);
}

/** Premier jour inclus de la période ; null pour « tout » */
export function periodStart(period: StatsPeriod, today: string): string | null {
  return period === 'all' ? null : addDays(today, -(PERIOD_DAYS[period] - 1));
}
