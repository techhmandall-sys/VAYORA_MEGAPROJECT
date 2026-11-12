// Lists every sentence the app shows that the Hindi or Marathi tables cannot translate: the web
// app's tables (src/shared) plus the app's own (src/locales.ts). Exits non-zero if any is missing.
//
//   node scripts/check-translations.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'shared' && name !== 'node_modules') yield* files(path);
    } else if (/\.tsx?$/.test(name) && name !== 'locales.ts') {
      yield path;
    }
  }
}

// A quoted sentence: single or double quotes, escapes allowed.
const QUOTED = String.raw`'((?:[^'\\]|\\.)+)'|"((?:[^"\\]|\\.)+)"`;
const PATTERNS = [
  // t('...') and t("...")
  new RegExp(String.raw`\bt\(\s*(?:${QUOTED})`, 'g'),
  // setError('...'), setRouteError, setFormError, and Notice text set that way
  new RegExp(String.raw`\bset(?:Route|Form)?Error\(\s*(?:${QUOTED})`, 'g'),
  // Entries of the maps whose values are shown through t: REFUSED, STATUS
  new RegExp(String.raw`^\s+[A-Z_]+:\s*\[?\s*(?:${QUOTED})`, 'gm'),
  new RegExp(String.raw`^\s+[a-z_]+:\s*(?:${QUOTED}),?$`, 'gm'),
];

const shown = new Set();
for (const file of [...files(join(root, 'app')), ...files(join(root, 'src'))]) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = (match[1] ?? match[2]).replace(/\\'/g, "'").replace(/\\"/g, '"');
      // Only sentences and labels: skip ids, paths, colours, HTTP methods and placeholders of code.
      if ((/^[A-Z{]/.test(value) || / /.test(value)) && !/^[A-Z]+$/.test(value)) shown.add(value);
    }
  }
}

const table = (path, name) => {
  const text = readFileSync(path, 'utf8');
  const keys = new Set();
  for (const match of text.matchAll(/^\s+(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z]+)):/gm)) {
    keys.add((match[1] ?? match[2] ?? match[3]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return keys;
};
const extra = table(join(root, 'src', 'locales.ts'));
const missing = { hi: [], mr: [] };
for (const language of ['hi', 'mr']) {
  const keys = table(join(root, 'src', 'shared', `${language}.ts`));
  for (const value of [...shown].sort()) if (!keys.has(value) && !extra.has(value)) missing[language].push(value);
}

console.log(`${shown.size} sentences shown; missing in Hindi: ${missing.hi.length}, in Marathi: ${missing.mr.length}`);
for (const value of [...new Set([...missing.hi, ...missing.mr])]) console.log(`  ${JSON.stringify(value)}`);
process.exit(missing.hi.length || missing.mr.length ? 1 : 0);
