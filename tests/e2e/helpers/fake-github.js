// Feste GitHub-Antworten fuer Tests des Review-Nachweis-Laeufers
// (scripts/review-nachweis.mjs), ohne Netz. Wird mit `node --import` vor
// dem Laeufer geladen und ersetzt fetch().
//
// Szenario: JSON-Datei in FAKE_GITHUB, { "routen": { "GET repos/o/r/pulls/1":
// [antwort1, antwort2, ...] } }. Schluessel ist Methode plus Pfad ohne Query.
// Die Antworten einer Route kommen der Reihe nach, die letzte wiederholt sich.
// Ohne Route: GET liefert [], alles andere {}. Jede Anfrage landet als
// JSON-Zeile in FAKE_GITHUB_LOG, damit der Test sieht, was geschrieben wurde.
import { readFileSync, appendFileSync } from 'node:fs';

const szenario = JSON.parse(readFileSync(process.env.FAKE_GITHUB, 'utf8'));
const zaehler = new Map();

globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
  const u = new URL(url);
  if (u.hostname !== 'api.github.com') throw new Error(`fake-github: fremder Host ${u.hostname}`);
  const schluessel = `${method} ${u.pathname.slice(1)}`;
  appendFileSync(process.env.FAKE_GITHUB_LOG, JSON.stringify({ schluessel, body: body ? JSON.parse(body) : undefined }) + '\n');
  const reihe = szenario.routen[schluessel];
  let antwort = method === 'GET' ? [] : {};
  if (reihe) {
    const i = zaehler.get(schluessel) || 0;
    zaehler.set(schluessel, i + 1);
    antwort = reihe[Math.min(i, reihe.length - 1)];
  }
  return new Response(JSON.stringify(antwort), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
