// Regressionsschutz für das RSI-Verified-Badge: Elemente im Dossier-Dashboard
// werden per hidden-Attribut aus dem JS getoggelt. account-dossier.css stammt
// aber aus der statischen Vorschau und setzt display:… auf genau diesen Klassen
// (.ph__chip, .dsr img). Autor-CSS schlägt die UA-Regel [hidden]{display:none}
// IMMER — ohne Guard war das Chip "RSI Verified" auch unverifiziert sichtbar.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const dossierCss = fs.readFileSync(path.resolve('assets/account-dossier.css'), 'utf8');
const dashboard = fs.readFileSync(
  path.resolve('src/components/account/AccountDashboard.astro'),
  'utf8',
);

describe('Account-Dossier: hidden-Attribut', () => {
  test('1. .dsr [hidden] setzt display:none !important', () => {
    assert.match(dossierCss, /\.dsr\s*\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/);
  });

  test('2. Das RSI-Verified-Chip startet hidden (JS blendet es nur bei rsi_verified=true ein)', () => {
    assert.match(dashboard, /id="ovVerified"[^>]*\shidden/);
  });

  test('3. .ph__chip setzt weiterhin display — der Guard ist also nötig, nicht optional', () => {
    assert.match(dossierCss, /\.ph__chip\s*\{[^}]*display\s*:\s*inline-flex/);
  });
});
