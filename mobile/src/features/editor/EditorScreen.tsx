// Cadre commun d'une étape de l'éditeur : écran, en-tête, erreurs d'enregistrement (feuille unique)
import { useEffect, useState, type ReactNode } from 'react';
import { Screen } from '@/features/common/Screen';
import { useI18n } from '@/i18n/I18nProvider';
import { useDraftStore } from '@/state/draftStore';
import { EditorHeader } from './EditorHeader';
import type { EditorNav, EditorStep } from './nav';
import { SaveErrorsSheet } from './SaveErrorsSheet';
import { useEditorActions } from './useEditorActions';

/** Actions exposées aux étapes : enregistrer, et signaler un glisser-déposer (bloque le défilement) */
export type EditorActions = { save(): void; onDragStateChange(dragging: boolean): void };
type Children = ReactNode | ((actions: EditorActions) => ReactNode);

export function EditorScreen({ nav, step, children }: { nav: EditorNav; step?: EditorStep; children: Children }) {
  const { t } = useI18n();
  const draft = useDraftStore((s) => s.draft);
  const { save, cancel, errors, dismissErrors, goToError } = useEditorActions(nav);
  const { finish } = nav;
  const [dragging, setDragging] = useState(false);

  // Plus de brouillon (enregistré, annulé ou absent) → sortie de l'éditeur
  useEffect(() => {
    if (!draft) finish();
  }, [draft, finish]);

  if (!draft) return null;
  const sessionName = (key: string) => draft.program.sessions[key]?.name || t('editor_no_name');
  return (
    <Screen scrollEnabled={!dragging}>
      <EditorHeader step={step} onCancel={() => void cancel()} onSave={save} />
      {typeof children === 'function' ? children({ save, onDragStateChange: setDragging }) : children}
      <SaveErrorsSheet errors={errors} sessionName={sessionName} onSelect={goToError} onClose={dismissErrors} />
    </Screen>
  );
}
