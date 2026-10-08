// Le vrai adaptateur de partage (mocké ailleurs) : sur iOS, fermer la feuille sans partager = 'cancelled'
jest.unmock('@/platform/shareJsonFile');

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: jest.fn().mockImplementation((_dir: string, name: string) => ({ uri: `file:///cache/${name}`, create: jest.fn(), write: jest.fn() })),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(() => Promise.resolve(true)), shareAsync: jest.fn(() => Promise.resolve()) }));

import { Platform, Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { shareJsonFile } from '../shareJsonFile';

describe('shareJsonFile (natif)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('iOS : feuille fermée sans partage → cancelled', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
    await expect(shareJsonFile('backup.json', '{}')).resolves.toBe('cancelled');
  });

  it('iOS : fichier partagé → shared, via l\'URL du fichier', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    await expect(shareJsonFile('backup.json', '{}')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ url: 'file:///cache/backup.json' });
  });

  it('Android : feuille système (annulation non détectable) → shared', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await expect(shareJsonFile('backup.json', '{}')).resolves.toBe('shared');
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });
});
