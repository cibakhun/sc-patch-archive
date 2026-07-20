// env.mjs — dependency-free .env loader + client-id derivation.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function loadEnv() {
  const p = join(here, '..', '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

/** A bot token's first segment is the base64url-encoded application id. */
export function deriveClientId(token) {
  try {
    const seg = String(token).split('.')[0];
    const id = Buffer.from(seg, 'base64').toString('utf8');
    return /^\d{17,20}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}
