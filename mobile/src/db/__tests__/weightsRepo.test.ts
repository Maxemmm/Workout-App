/** @jest-environment node */
import { getAllWeights, setWeight } from '../repos/weightsRepo';
import { createTestCtx } from '../testing/createTestCtx';

describe('weightsRepo', () => {
  it('enregistre, met à jour et relit par clé', () => {
    const ctx = createTestCtx();
    setWeight(ctx, 'presse', 100, 'kg');
    setWeight(ctx, 'presse', 102.5, 'kg');
    setWeight(ctx, 'presse::Fentes', 12, 'kg');
    expect(getAllWeights(ctx)).toEqual({ presse: { weight: 102.5, unit: 'kg' }, 'presse::Fentes': { weight: 12, unit: 'kg' } });
  });

  it('null efface (suppression logique) puis une nouvelle valeur est acceptée', () => {
    const ctx = createTestCtx();
    setWeight(ctx, 'presse', 100, 'kg');
    setWeight(ctx, 'presse', null, 'kg');
    expect(getAllWeights(ctx)).toEqual({});
    setWeight(ctx, 'presse', 220, 'lbs');
    expect(getAllWeights(ctx)).toEqual({ presse: { weight: 220, unit: 'lbs' } });
  });
});
