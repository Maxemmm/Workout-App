// Web : pas de notification de minuteur (adaptateur inerte)
import type { NoticeAction, NotifierPermission, ScheduledNotice } from './types';

export const REST_NOTICE_ID = 'rest-end';

export const restNotifier = {
  async permission(): Promise<NotifierPermission> { return 'unavailable'; },
  async requestPermission(): Promise<boolean> { return false; },
  async schedule(_n: ScheduledNotice): Promise<void> {},
  async cancel(): Promise<void> {},
  async configure(_labels: { plus15: string; validate: string }): Promise<void> {},
  onAction(_cb: (a: NoticeAction) => void): () => void { return () => {}; },
  async lastAction(): Promise<NoticeAction | null> { return null; },
  async openSettings(): Promise<void> {},
};
