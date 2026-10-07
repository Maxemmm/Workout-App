import { newDraft } from '../draft';

describe('newDraft', () => {
  it('unité kg par défaut, lbs sur demande', () => {
    expect(newDraft().program.meta.units).toBe('kg');
    expect(newDraft('lbs').program.meta.units).toBe('lbs');
  });
});
