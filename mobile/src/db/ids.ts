// ============================================================
// Identifiants UUID v7 — générés sur l'appareil, triables par date
// (48 bits de timestamp ms + aléa). La source d'aléa est injectée :
// expo-crypto dans l'app, node:crypto dans les tests.
// ============================================================
export function createIdGenerator(
  randomBytes: (n: number) => Uint8Array,
  nowMs: () => number = Date.now,
): () => string {
  return () => {
    const b = Uint8Array.from(randomBytes(16));
    const ts = nowMs();
    b[0] = Math.floor(ts / 2 ** 40) & 0xff;
    b[1] = Math.floor(ts / 2 ** 32) & 0xff;
    b[2] = (ts >>> 24) & 0xff;
    b[3] = (ts >>> 16) & 0xff;
    b[4] = (ts >>> 8) & 0xff;
    b[5] = ts & 0xff;
    b[6] = 0x70 | (b[6] & 0x0f); // version 7
    b[8] = 0x80 | (b[8] & 0x3f); // variante RFC 4122
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}
