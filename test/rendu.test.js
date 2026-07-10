import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { entreesBase } from '../src/catalogue.js';
import { enBlocs } from '../src/rendu.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAT = JSON.parse(await readFile(join(__dirname, '..', 'data', 'catalogue.json'), 'utf-8'));

const titres = (blocs) => blocs.filter((b) => b.type === 'titre').map((b) => b.texte);

test('aucun bandeau de catégorie n\'est répété (Vigile : docteurs scindés)', () => {
  const blocs = enBlocs(entreesBase(CAT, 'vigile-pascale'));
  const t = titres(blocs);
  assert.equal(new Set(t).size, t.length, `bandeaux dupliqués : ${t.join(', ')}`);
  assert.ok(t.includes('Évêques et docteurs'), 'le bandeau existe bien une fois');
});

test('par défaut, un bienheureux apparaît sous le bandeau de SA catégorie', () => {
  const entrees = entreesBase(CAT);
  entrees.push({ saintId: 'bx', invocation: 'Bienheureux Frédéric Ozanam', categorie: 'laics', sexe: 'M', anneeDeces: 1853, type: 'bienheureux' });
  const titres = enBlocs(entrees).filter((b) => b.type === 'titre').map((b) => b.texte);
  assert.ok(titres.includes('Laïcs'), titres.join(' | '));
  assert.ok(!titres.some((t) => t.startsWith('Bienheureux')), 'aucun bandeau « Bienheureux » séparé');
});

test('en mode « bienheureux à la fin », un bandeau « Bienheureux — … » apparaît', () => {
  const entrees = entreesBase(CAT);
  entrees.push({ saintId: 'bx', invocation: 'Bienheureux Frédéric Ozanam', categorie: 'laics', sexe: 'M', anneeDeces: 1853, type: 'bienheureux' });
  const titres = enBlocs(entrees, { bienheureuxALaFin: true }).filter((b) => b.type === 'titre').map((b) => b.texte);
  assert.ok(titres.includes('Bienheureux — Laïcs'), titres.join(' | '));
});

test('la litanie se termine par l\'invocation de conclusion', () => {
  const blocs = enBlocs(entreesBase(CAT));
  const dernier = blocs[blocs.length - 1];
  assert.equal(dernier.type, 'invocation');
  assert.match(dernier.texte, /Tous les saints et saintes de Dieu/);
  assert.ok(dernier.conclusion);
});
