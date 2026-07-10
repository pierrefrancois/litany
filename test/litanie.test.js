import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { construireLitanie, normaliser } from '../src/litanie.js';
import { comparerPreseance } from '../src/precedence.js';
import { entreesBase, infoSaint } from '../src/catalogue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAT = JSON.parse(await readFile(join(__dirname, '..', 'data', 'catalogue.json'), 'utf-8'));
const BASE = entreesBase(CAT);

const ordre = (entrees) => entrees.map((e) => e.saintId || e.invocation);
const pos = (entrees, id) => entrees.findIndex((e) => e.saintId === id);
const ajouter = (...ids) => construireLitanie(BASE, ids.map((id) => infoSaint(CAT, id)));

test('la base par défaut est la litanie courte du baptême des enfants', () => {
  assert.deepEqual(ordre(BASE), [
    'marie',
    'jean-baptiste',
    'joseph',
    'Saint Pierre et saint Paul',
  ]);
});

test('Joseph reste le dernier des patriarches même si on ajoute un prophète', () => {
  const elie = { saintId: 'elie-test', invocation: 'Saint Élie', categorie: 'patriarches_prophetes', sexe: 'M', anneeDeces: null, type: 'saint' };
  const { entrees } = construireLitanie(BASE, [elie]);
  const patr = entrees.filter((e) => e.categorie === 'patriarches_prophetes');
  assert.equal(patr[patr.length - 1].saintId, 'joseph');
});

test('un saint de catégorie absente est placé au bon rang de catégorie', () => {
  // Augustin (évêques-docteurs, rang 5) doit venir après Pierre&Paul (apôtres, rang 3)
  // et avant la conclusion. Michel (anges, rang 1) entre Marie et Jean-Baptiste.
  const { entrees } = ajouter('augustin');
  const iPP = entrees.findIndex((e) => e.couvre); // ligne Pierre & Paul
  const iAug = pos(entrees, 'augustin');
  assert.ok(iPP < iAug, 'Augustin après les apôtres');

  const { entrees: e2 } = ajouter('michel');
  const iMarie = pos(e2, 'marie');
  const iMichel = pos(e2, 'michel');
  const iJB = pos(e2, 'jean-baptiste');
  assert.ok(iMarie < iMichel && iMichel < iJB, 'Michel entre Marie et Jean-Baptiste');
});

test('hommes avant femmes, puis par date de mort, dans une catégorie ajoutée', () => {
  const { entrees } = ajouter('laurent', 'sebastien', 'come', 'blandine', 'agnes');
  const m = entrees.filter((e) => e.categorie === 'martyrs').map((e) => e.saintId);
  // hommes par date : Laurent 258, Côme 287, Sébastien 288 ; puis femmes : Blandine 177, Agnès 304
  assert.deepEqual(m, ['laurent', 'come', 'sebastien', 'blandine', 'agnes']);
});

test('le dies natalis prime (ni naissance ni canonisation) ; saint avant bienheureux', () => {
  const a = { categorie: 'eveques_docteurs', sexe: 'M', anneeDeces: 400 };
  const b = { categorie: 'eveques_docteurs', sexe: 'M', anneeDeces: 500 };
  assert.ok(comparerPreseance(a, b) < 0);
  const saint = { categorie: 'laics', sexe: 'M', anneeDeces: 1900, type: 'saint' };
  const bx = { categorie: 'laics', sexe: 'M', anneeDeces: 1900, type: 'bienheureux' };
  assert.ok(comparerPreseance(saint, bx) < 0);
});

test('un bienheureux se place « suis locis » : dans sa catégorie, par date (OCM)', () => {
  // Exemple Adoremus/OCM : Bx Miguel Pro (martyr, †1927) va CHEZ LES MARTYRS,
  // donc avant un saint laïc — il n'est PAS rejeté à la fin de la litanie.
  const miguelPro = { saintId: 'miguel-pro', invocation: 'Bienheureux Miguel Pro', categorie: 'martyrs', sexe: 'M', anneeDeces: 1927, type: 'bienheureux' };
  const { entrees } = construireLitanie(BASE, [infoSaint(CAT, 'louis'), miguelPro]);
  assert.ok(pos(entrees, 'miguel-pro') < pos(entrees, 'louis'), 'bx martyr (cat. martyrs) avant saint laïc');
});

test('dans une catégorie, un bienheureux s\'ordonne par date parmi les saints', () => {
  // Bx martyr de 250 vs saints martyrs de la base : il se glisse à sa date.
  const bxTres = { saintId: 'bx-tres', invocation: 'Bx Ancien', categorie: 'martyrs', sexe: 'M', anneeDeces: 250, type: 'bienheureux' };
  const { entrees } = construireLitanie(BASE, [infoSaint(CAT, 'laurent'), infoSaint(CAT, 'sebastien'), bxTres]);
  // Laurent †258, Sébastien †288 : le bx de 250 passe avant Laurent.
  assert.ok(pos(entrees, 'bx-tres') < pos(entrees, 'laurent'), 'bx †250 avant Laurent †258');
});

test('option « bienheureux à la fin » : tous les bienheureux après les saints', () => {
  const bxMartyr = { saintId: 'bx-m', invocation: 'Bx M', categorie: 'martyrs', sexe: 'M', anneeDeces: 1927, type: 'bienheureux' };
  const { entrees } = construireLitanie(BASE, [infoSaint(CAT, 'louis'), bxMartyr], { bienheureuxALaFin: true });
  assert.ok(pos(entrees, 'louis') < pos(entrees, 'bx-m'), 'saint laïc avant bx martyr (mode à-la-fin)');
  assert.equal(entrees[entrees.length - 1].saintId, 'bx-m', 'le bienheureux clôt la litanie');
});

test('déduplication : Jean-Baptiste (en base) et Pierre (couvert par la ligne combinée)', () => {
  const r = ajouter('jean-baptiste', 'pierre', 'paul');
  assert.equal(r.ajouts.length, 0);
  assert.equal(r.doublons.length, 3);
});

test('deux Élisabeth ajoutées s\'ordonnent par date de mort', () => {
  const { entrees } = ajouter('elisabeth-portugal', 'elisabeth-hongrie');
  assert.ok(pos(entrees, 'elisabeth-hongrie') < pos(entrees, 'elisabeth-portugal'));
});

test('normaliser enlève accents, casse et préfixe Saint', () => {
  assert.equal(normaliser('Saint Augustin'), 'augustin');
  assert.equal(normaliser('Côme'), 'come');
});
