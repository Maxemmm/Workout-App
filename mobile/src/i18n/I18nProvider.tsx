// Contexte de langue — fournit t() et tList() aux écrans
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LANG, type Lang } from '@/domain/prefs';
import { translate, translateList, type ListKey, type StringKey } from './translate';

const I18nContext = createContext<Lang>(DEFAULT_LANG);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <I18nContext.Provider value={lang}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const lang = useContext(I18nContext);
  return useMemo(
    () => ({
      lang,
      t: (key: StringKey, ...args: (string | number)[]) => translate(lang, key, ...args),
      tList: (key: ListKey) => translateList(lang, key),
    }),
    [lang],
  );
}
