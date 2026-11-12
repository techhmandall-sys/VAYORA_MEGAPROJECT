// Copies what the mobile app shares with the web app: the Hindi and Marathi tables and the list of
// places a ride can start, stop or end. The web app is where they are kept; run this after they change:
//
//   npm run sync-shared
//
// The copies are committed, so the app builds on its own (Expo Go and the cloud build see only
// this folder).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..', '..', 'web', 'src', 'lib');
const out = join(here, '..', 'src', 'shared');
mkdirSync(out, { recursive: true });

const NOTE = '// Copied from web/src/lib by mobile/scripts/sync-shared.mjs. Change it there, then run npm run sync-shared.\n';

for (const name of ['hi', 'mr']) {
  const text = readFileSync(join(web, 'locales', `${name}.ts`), 'utf8');
  writeFileSync(join(out, `${name}.ts`), NOTE + text);
}

// The web marks each place name with msg() for its translation check; here it is plain text.
const places = readFileSync(join(web, 'places.ts'), 'utf8').replace(
  "import { msg } from './i18n';",
  'const msg = (text: string): string => text;',
);
if (!places.includes('const msg = ')) throw new Error('places.ts no longer imports msg as expected');
writeFileSync(join(out, 'places.ts'), NOTE + places);

console.log('Copied hi.ts, mr.ts and places.ts into src/shared.');
