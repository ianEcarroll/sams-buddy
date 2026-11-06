// Builds web/public/symbols from the Mulberry Symbols set (CC BY-SA 4.0, © Steve Lee, https://mulberrysymbols.org).
// Usage: git clone --depth 1 https://github.com/mulberrysymbols/mulberry-symbols /tmp/mulberry
//        node scripts/build-symbols.mjs /tmp/mulberry/EN
// Writes one minified SVG per symbol (safe lower-case file names) and index.json for the picture search.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { optimize } from 'svgo';

const src = process.argv[2];
if (!src) { console.error('Give the Mulberry EN folder.'); process.exit(1); }
const out = new URL('../public/symbols/', import.meta.url).pathname;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

export const slugOf = (file) => file.replace(/\.svg$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// "deliver_,_to" → "to deliver"; "suit_-_ladys" → "suit - ladys"; "doctor_1a" → "doctor 1a"
const labelOf = (file) => {
  let s = file.replace(/\.svg$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const verb = s.match(/^(.*?)\s*,\s*to$/);
  if (verb) s = `to ${verb[1]}`;
  return s;
};

// Flags and country maps are large and not needed for Buddy's activities.
const SKIP = /^(flag|country)-/;
const index = [];
const seen = new Set();
for (const f of readdirSync(src).filter((x) => x.toLowerCase().endsWith('.svg')).sort()) {
  const slug = slugOf(f);
  if (!slug || seen.has(slug) || SKIP.test(slug)) continue;
  seen.add(slug);
  const { data } = optimize(readFileSync(join(src, f), 'utf8'), { multipass: true, plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false } } }] });
  writeFileSync(join(out, `${slug}.svg`), data);
  index.push([slug, labelOf(f)]);
}
writeFileSync(join(out, 'index.json'), JSON.stringify(index));
writeFileSync(join(out, 'LICENSE.txt'), 'Mulberry Symbols, Copyright 2018-2026 Steve Lee (https://mulberrysymbols.org).\nLicensed under the Creative Commons Attribution-ShareAlike 4.0 International License: https://creativecommons.org/licenses/by-sa/4.0/\nFiles here are minified and renamed (lower-case, hyphens); the drawings are unchanged. Flags and country maps are left out.\n');
console.log(`${index.length} symbols written to ${out}`);
