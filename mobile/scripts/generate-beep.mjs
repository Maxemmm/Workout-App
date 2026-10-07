// Génère assets/sounds/rest-done.wav : deux bips (880 Hz puis 1100 Hz), comme la PWA.
// Usage : node scripts/generate-beep.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const beeps = [{ freq: 880, start: 0, dur: 0.22 }, { freq: 1100, start: 0.28, dur: 0.28 }];
const total = Math.ceil((0.28 + 0.28 + 0.05) * RATE);
const samples = new Int16Array(total);
for (const { freq, start, dur } of beeps) {
  const from = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const gain = 0.28 * Math.pow(0.001 / 0.28, t / dur); // décroissance exponentielle 0.28 → 0.001
    samples[from + i] += Math.round(Math.sin(2 * Math.PI * freq * t) * gain * 32767);
  }
}
const data = Buffer.from(samples.buffer);
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/sounds/rest-done.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([header, data]));
console.log(`écrit ${out} (${data.length + 44} octets)`);
