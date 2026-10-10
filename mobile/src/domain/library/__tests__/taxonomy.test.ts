import { EQUIPMENT_KEYS, equipmentLabel, isEquipmentKey } from '../equipment';
import { isMuscleKey, MUSCLE_KEYS, muscleLabel } from '../muscles';

describe('muscles', () => {
  it('22 clés uniques, libellés fr / en non vides', () => {
    expect(MUSCLE_KEYS).toHaveLength(22);
    expect(new Set(MUSCLE_KEYS).size).toBe(22);
    for (const k of MUSCLE_KEYS) {
      expect(muscleLabel(k, 'fr').length).toBeGreaterThan(0);
      expect(muscleLabel(k, 'en').length).toBeGreaterThan(0);
    }
    expect(muscleLabel('hamstrings', 'fr')).toBe('Ischio-jambiers');
    expect(muscleLabel('lats', 'en')).toBe('Lats');
  });
  it('garde de type', () => {
    expect(isMuscleKey('chest')).toBe(true);
    expect(isMuscleKey('pectorals')).toBe(false);
  });
});

describe('matériel', () => {
  it('13 clés uniques, libellés fr / en', () => {
    expect(EQUIPMENT_KEYS).toHaveLength(13);
    expect(new Set(EQUIPMENT_KEYS).size).toBe(13);
    expect(equipmentLabel('dumbbell', 'fr')).toBe('Haltères');
    expect(equipmentLabel('cable', 'fr')).toBe('Poulie');
    expect(isEquipmentKey('bodyweight')).toBe(true);
    expect(isEquipmentKey('body weight')).toBe(false);
  });
});
