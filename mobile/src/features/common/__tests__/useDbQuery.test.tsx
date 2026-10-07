import { act, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { getSetting, setSetting } from '@/db/repos/settingsRepo';
import { createTestCtx } from '@/db/testing/createTestCtx';
import type { RepoCtx } from '@/db/types';
import { PREFS_INITIAL, usePrefs } from '@/state/prefsStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import { useDbQuery } from '../useDbQuery';

function readLabel(ctx: RepoCtx, prefix: string, suffix: string): string {
  return `${prefix}${String(getSetting(ctx, 'activeProgramId') ?? '-')}${suffix}`;
}

function Probe({ prefix }: { prefix: string }) {
  const label = useDbQuery(readLabel, prefix, '!');
  return <Text>{label}</Text>;
}

describe('useDbQuery', () => {
  beforeEach(async () => {
    await act(async () => { usePrefs.setState(PREFS_INITIAL); });
  });

  it('passe les arguments à la requête et relit après bumpData', async () => {
    const ctx = createTestCtx();
    await renderWithProviders(<Probe prefix="id:" />, { ctx });
    expect(screen.getByText('id:-!')).toBeTruthy();

    setSetting(ctx, 'activeProgramId', 'abc');
    await act(async () => { usePrefs.getState().bumpData(); });
    expect(screen.getByText('id:abc!')).toBeTruthy();
  });
});
