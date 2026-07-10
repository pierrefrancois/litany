import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idDepuisNom, qualiteDepuisLibelle, saintDepuisCandidat, fusionnerCatalogue } from '../src/enrichissement.js';

test('idDepuisNom : kebab-case sans honorifique ni accent', () => {
  assert.equal(idDepuisNom('Saint Côme'), 'come');
  assert.equal(idDepuisNom('Saint Maximilien Kolbe'), 'maximilien-kolbe');
  assert.equal(idDepuisNom('Bienheureuse Blandine Merten'), 'blandine-merten');
});

test('qualiteDepuisLibelle : retire (+ année) / (siècle) / †', () => {
  assert.equal(qualiteDepuisLibelle('Soldat, martyr en Numidie (+ 295)'), 'Soldat, martyr en Numidie');
  assert.equal(qualiteDepuisLibelle('Abbé en Bretagne, à Landévennec (VIe siècle)'), 'Abbé en Bretagne, à Landévennec');
  assert.equal(qualiteDepuisLibelle("évêque d'Hippone, Docteur de l'Église (+ 430)"), "évêque d'Hippone, Docteur de l'Église");
});

test('saintDepuisCandidat : entrée de catalogue complète, prénom devenu alias', () => {
  const cand = { nom: 'Saint Maximilien Kolbe', nomCourt: 'Maximilien Kolbe', libelle: 'Frère mineur, martyr (+ 1941)', url: 'http://x', sexe: 'M', type: 'saint', categorie: 'martyrs', anneeDeces: 1941 };
  const { id, saint } = saintDepuisCandidat(cand, 'Maximilien');
  assert.equal(id, 'maximilien-kolbe');
  assert.equal(saint.categorie, 'martyrs');
  assert.equal(saint.anneeDeces, 1941);
  assert.equal(saint.type, 'saint');
  assert.equal(saint.i18n.fr.nom, 'Saint Maximilien Kolbe');
  assert.equal(saint.i18n.fr.qualite, 'Frère mineur, martyr');
  assert.ok(saint.prenoms.includes('maximilien'), 'le prénom tapé est un alias');
  assert.equal(saint.source, 'nominis');
});

test('saintDepuisCandidat : un bienheureux garde son type', () => {
  const cand = { nom: 'Bienheureuse Blandine Merten', nomCourt: 'Blandine Merten', libelle: 'Religieuse ursuline (+ 1918)', sexe: 'F', type: 'bienheureux', categorie: 'pretres_religieux', anneeDeces: 1918 };
  const { saint } = saintDepuisCandidat(cand, 'Blandine');
  assert.equal(saint.type, 'bienheureux');
  assert.equal(saint.sexe, 'F');
});

test('fusionnerCatalogue : les saints curés priment sur les locaux ; bases conservées', () => {
  const cure = { bases: { x: {} }, saints: { augustin: { categorie: 'eveques_docteurs' } } };
  const local = { saints: { augustin: { categorie: 'AUTRE' }, 'maximilien-kolbe': { categorie: 'martyrs' } } };
  const m = fusionnerCatalogue(cure, local);
  assert.equal(m.saints.augustin.categorie, 'eveques_docteurs', 'le curé prime');
  assert.ok(m.saints['maximilien-kolbe'], 'le local ajouté est présent');
  assert.deepEqual(m.bases, { x: {} });
});

test('fusionnerCatalogue tolère une extension locale vide ou absente', () => {
  const cure = { saints: { a: {} } };
  assert.deepEqual(fusionnerCatalogue(cure, null).saints, { a: {} });
  assert.deepEqual(fusionnerCatalogue(cure, { saints: {} }).saints, { a: {} });
});
