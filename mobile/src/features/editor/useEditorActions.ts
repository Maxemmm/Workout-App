// Enregistrer / annuler depuis n'importe quelle étape
import { useState } from 'react';
import { useRepoCtx } from '@/db/DbContext';
import type { DraftError } from '@/domain/programRules';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { useDraftStore } from '@/state/draftStore';
import { usePrefs } from '@/state/prefsStore';
import { useToastStore } from '@/state/toastStore';
import type { EditorNav } from './nav';
import { saveDraft, type SaveResult } from './saveDraft';

/** Hors composant : un try/catch ici n'empêche pas le React Compiler d'optimiser les écrans */
function trySave(run: () => SaveResult): SaveResult | null {
  try {
    return run();
  } catch {
    return null;
  }
}

export function useEditorActions(nav: EditorNav) {
  const ctx = useRepoCtx();
  const { t } = useI18n();
  const [errors, setErrors] = useState<DraftError[] | null>(null);

  const save = () => {
    const draft = useDraftStore.getState().draft;
    if (!draft) return;
    const result = trySave(() => saveDraft(ctx, draft));
    if (!result) {
      useToastStore.getState().show(t('error_not_saved'));
      return;
    }
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    // La disparition du brouillon fait sortir de l'éditeur (EditorScreen appelle nav.finish une seule fois)
    useDraftStore.getState().discard(ctx);
    usePrefs.getState().bumpData();
    useToastStore.getState().show(t('editor_saved'));
  };

  const cancel = async () => {
    // Rien de modifié : rien à perdre, sortie directe
    if (!useDraftStore.getState().dirty) {
      useDraftStore.getState().discard(ctx);
      return;
    }
    const ok = await confirm({ title: t('editor_cancel_title'), message: t('editor_cancel_body'), confirmLabel: t('editor_discard'), cancelLabel: t('editor_keep'), destructive: true });
    if (!ok) return;
    useDraftStore.getState().discard(ctx);
  };

  const goToError = (e: DraftError) => {
    setErrors(null);
    if (e.step === 4 && e.sessionKey) nav.openSession(e.sessionKey);
    else nav.goToStep(e.step === 4 ? 2 : e.step);
  };

  return { save, cancel, errors, dismissErrors: () => setErrors(null), goToError };
}
