/**
 * Downloads the NASA Exoplanet Archive and writes the small snapshot the app
 * ships with (src/data/exoplanets.json). The archive does not allow requests
 * from web pages, so this runs on a computer or in CI instead.
 *
 *   pnpm data:exoplanets
 *   node scripts/fetch-exoplanets.ts --input rows.json --out /tmp/x.json --min 1   (offline test)
 *
 * Needs Node 22.18 or newer, which runs TypeScript files directly.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { shapeSnapshot } from '../src/discover/exoShape.ts';
import type { RawRow } from '../src/discover/exoShape.ts';

const COLUMNS = [
  'pl_name',
  'hostname',
  'discoverymethod',
  'disc_year',
  'disc_pubdate',
  'pl_orbper',
  'pl_rade',
  'pl_bmasse',
  'pl_eqt',
  'pl_orbsmax',
  'sy_dist',
  'sy_pnum',
  'st_teff',
];
const URL_BASE = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function fetchRows(): Promise<RawRow[]> {
  const input = arg('input');
  if (input) return JSON.parse(await readFile(input, 'utf8'));
  const query = `select ${COLUMNS.join(',')} from pscomppars`;
  const res = await fetch(`${URL_BASE}?${new URLSearchParams({ query, format: 'json' })}`, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`Archive answered HTTP ${res.status}`);
  return res.json();
}

const out = arg('out') ?? new URL('../src/data/exoplanets.json', import.meta.url).pathname;
const min = Number(arg('min') ?? 1000);

const rows = await fetchRows();
if (!Array.isArray(rows) || rows.length < min) {
  // Never overwrite good data with an empty or broken download.
  throw new Error(`Expected at least ${min} planets, got ${Array.isArray(rows) ? rows.length : 'a non-list reply'}. Keeping the existing file.`);
}

const snapshot = shapeSnapshot(rows);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(snapshot, null, 1)}\n`);
console.log(`Wrote ${out}: ${snapshot.total} planets, ${Object.keys(snapshot.byYear).length} discovery years.`);
