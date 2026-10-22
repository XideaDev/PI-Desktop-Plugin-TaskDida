import * as fs from 'node:fs';
import * as path from 'node:path';

const soundsDir = path.join(__dirname, '..', 'assets', 'sounds');
const sounds = ['complete.wav', 'error.wav', 'notify.wav'];

const base64Map: Record<string, string> = {};
for (const s of sounds) {
  const filePath = path.join(soundsDir, s);
  const base64 = fs.readFileSync(filePath).toString('base64');
  base64Map[s.replace('.wav', '')] = `data:audio/wav;base64,${base64}`;
}

const outContent = `// Auto-generated embedded base64 audio data for in-browser playback fallback
export const EMBEDDED_SOUNDS: Record<string, string> = ${JSON.stringify(base64Map, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'audio', 'embeddedSounds.ts'), outContent);
console.log('Embedded sounds generated.');
