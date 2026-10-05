import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import { dumpRawTables } from '@/db/client';
import { MigrationErrorScreen } from '../MigrationErrorScreen';

jest.mock('@/db/client', () => ({ dumpRawTables: jest.fn() }));

describe('MigrationErrorScreen', () => {
  it("affiche l'erreur d'export au lieu de planter si le dump échoue", async () => {
    (dumpRawTables as jest.Mock).mockImplementation(() => { throw new Error('disque illisible'); });
    await render(<MigrationErrorScreen error={new Error('migration KO')} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(screen.getByText(/disque illisible/)).toBeTruthy();
  });

  it('partage le dump quand il réussit et ne promet pas que les données sont intactes', async () => {
    (dumpRawTables as jest.Mock).mockReturnValue('{"t":[]}');
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await render(<MigrationErrorScreen error={new Error('migration KO')} />);
    expect(screen.queryByText(/intactes/)).toBeNull();
    await fireEvent.press(screen.getByRole('button'));
    expect(share).toHaveBeenCalledWith({ message: '{"t":[]}' });
  });
});
