import { moveId } from '../reorder';

describe('moveId', () => {
  const order = ['a', 'b', 'c', 'd'];
  it('déplace vers le bas et vers le haut', () => {
    expect(moveId(order, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveId(order, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it("borne les index et ne modifie pas l'entrée", () => {
    expect(moveId(order, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
    expect(moveId(order, 2, -3)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveId(order, 1, 1)).toEqual(order);
    expect(order).toEqual(['a', 'b', 'c', 'd']);
  });
  it('index de départ invalide : copie inchangée', () => {
    expect(moveId(order, 7, 0)).toEqual(order);
  });
});
