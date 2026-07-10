import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chercherCandidats, descriptionCandidat, siecle, listerBases, entreesBase, infoSaint } from '../src/catalogue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAT = JSON.parse(await readFile(join(__dirname, '..', 'data', 'catalogue.json'), 'utf-8'));

const ids = (liste) => liste.map((c) => c.saintId);

test('« Jean » est ambigu : propose plusieurs saints de catégories différentes', () => {
  const r = chercherCandidats(CAT, 'Jean');
  assert.ok(r.length >= 3, 'plusieurs Jean attendus');
  assert.ok(ids(r).includes('jean-baptiste'), 'Jean-Baptiste (prophètes)');
  assert.ok(ids(r).includes('jean'), "Jean l'apôtre");
  assert.ok(ids(r).includes('vianney'), 'Jean-Marie Vianney (prêtres)');
  // Le tri par pertinence place les alias exacts « jean » en tête.
  assert.equal(r[0].score, 3);
});

test('« Élisabeth » et la variante « Betty » renvoient les deux Élisabeth', () => {
  const parElisabeth = ids(chercherCandidats(CAT, 'Élisabeth'));
  assert.ok(parElisabeth.includes('elisabeth-hongrie'));
  assert.ok(parElisabeth.includes('elisabeth-portugal'));
  const parBetty = ids(chercherCandidats(CAT, 'Betty'));
  assert.ok(parBetty.includes('elisabeth-hongrie'), 'Betty -> Élisabeth de Hongrie');
});

test('« Thomas » distingue l\'apôtre du docteur', () => {
  const r = ids(chercherCandidats(CAT, 'Thomas'));
  assert.ok(r.includes('thomas'));
  assert.ok(r.includes('thomas-aquin'));
});

test('recherche par préfixe partiel', () => {
  const r = ids(chercherCandidats(CAT, 'Augus'));
  assert.ok(r.includes('augustin'));
});

test('infoSaint expose source/url (pour repérer un saint local corrigeable)', () => {
  const cat = { saints: { maurice: { categorie: 'martyrs', sexe: 'M', anneeDeces: 287, type: 'saint', source: 'nominis', url: 'http://x', i18n: { fr: { nom: 'Saint Maurice', qualite: '' } } } } };
  const info = infoSaint(cat, 'maurice');
  assert.equal(info.source, 'nominis');
  assert.equal(info.url, 'http://x');
  assert.equal(info.categorie, 'martyrs');
  // un saint de référence (sans source) n'est pas corrigeable
  const reference = { saints: { x: { categorie: 'laics', sexe: 'M', anneeDeces: 1, type: 'saint', i18n: { fr: { nom: 'X', qualite: '' } } } } };
  assert.equal(infoSaint(reference, 'x').source, null);
});

test('description de désambiguïsation et siècle', () => {
  const [augustin] = chercherCandidats(CAT, 'Augustin');
  assert.match(descriptionCandidat(augustin), /docteur/);
  assert.equal(siecle(430), 'Vᵉ s.');
  assert.equal(siecle(1231), 'XIIIᵉ s.');
});

test('chaque alias de prénom est résoluble et chaque id de chaque base existe', () => {
  for (const [id, s] of Object.entries(CAT.saints)) {
    for (const p of s.prenoms) {
      assert.ok(chercherCandidats(CAT, p).some((c) => c.saintId === id), `${p} -> ${id}`);
    }
  }
  for (const [cle, b] of Object.entries(CAT.bases)) {
    for (const e of b.entrees) {
      if (e.saint) assert.ok(CAT.saints[e.saint], `base ${cle} : id ${e.saint} existe`);
    }
  }
});

test('trois litanies de départ ; la Vigile pascale a sa composition propre', () => {
  const bases = listerBases(CAT).map((b) => b.cle);
  assert.deepEqual(bases, ['bapteme-enfants', 'vigile-pascale', 'complete']);

  const vigile = entreesBase(CAT, 'vigile-pascale');
  const ids = vigile.map((e) => e.saintId).filter(Boolean);
  assert.ok(ids.includes('michel') && ids.includes('marie-madeleine'), 'Michel et Marie-Madeleine présents');
  // Catherine de Sienne et Thérèse d'Avila sont rejetées en fin (ordre du Missel).
  assert.equal(vigile[vigile.length - 1].saintId, 'therese-avila');

  // base par défaut = baptême des enfants (courte)
  assert.equal(entreesBase(CAT).length, 4);
  // complète : longue
  assert.ok(entreesBase(CAT, 'complete').length > 60);
});
