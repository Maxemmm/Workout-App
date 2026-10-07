// Web : Alert de React Native Web est sans effet → window.confirm
import type { Confirm } from './types';

export const confirm: Confirm = async ({ title, message }) =>
  typeof window !== 'undefined' && window.confirm(message ? `${title}\n\n${message}` : title);
