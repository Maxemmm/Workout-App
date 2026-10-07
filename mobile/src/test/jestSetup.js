// ============================================================
// Setup Jest — mocks des bibliothèques natives et des adaptateurs platform/.
// Les adaptateurs sont vérifiés à la main sur appareil (checklist).
// ============================================================
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');

jest.mock('@/platform/haptics', () => ({ haptics: { light: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('@/platform/sound', () => ({ sound: { playRestDone: jest.fn() } }));
jest.mock('@/platform/keepAwake', () => ({ keepAwake: { activate: jest.fn(), deactivate: jest.fn() } }));
jest.mock('@/platform/confirm', () => ({ confirm: jest.fn(() => Promise.resolve(true)) }));
jest.mock('@/platform/pickJsonFile', () => ({
  MAX_IMPORT_BYTES: 5 * 1024 * 1024,
  pickJsonFile: jest.fn(() => Promise.resolve({ kind: 'cancel' })),
}));
