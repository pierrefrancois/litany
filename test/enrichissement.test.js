import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idDepuisNom, qualiteDepuisLibelle, saintDepuisCandidat, fusionnerCatalogue, trouverEquivalent } from '../src/enrichissement.js';

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
  const cand = { nom: 'Saint Maximilien Kolbe', nomCourt: 'Maximilien Kolbe', libelle: 'Frère mineur, martyr (+ 1941)', url: 'http://x', sexe: 'M', type: 'saint', categorie: 'martyrs', annusNatalis: 1941 };
  const { id, saint } = saintDepuisCandidat(cand, 'Maximilien');
  assert.equal(id, 'maximilien-kolbe');
  assert.equal(saint.categorie, 'martyrs');
  assert.equal(saint.annusNatalis, 1941);
  assert.equal(saint.type, 'saint');
  assert.equal(saint.i18n.fr.nom, 'Saint Maximilien Kolbe');
  assert.equal(saint.i18n.fr.qualite, 'Frère mineur, martyr');
  assert.ok(saint.prenoms.includes('maximilien'), 'le prénom tapé est un alias');
  assert.equal(saint.source, 'nominis');
});

test('saintDepuisCandidat : un bienheureux garde son type', () => {
  const cand = { nom: 'Bienheureuse Blandine Merten', nomCourt: 'Blandine Merten', libelle: 'Religieuse ursuline (+ 1918)', sexe: 'F', type: 'bienheureux', categorie: 'pretres_religieux', annusNatalis: 1918 };
  const { saint } = saintDepuisCandidat(cand, 'Blandine');
  assert.equal(saint.type, 'bienheureux');
  assert.equal(saint.sexe, 'F');
});

test('fusionnerCatalogue : les saints de référence priment sur les locaux ; bases conservées', () => {
  const reference = { bases: { x: {} }, saints: { augustin: { categorie: 'eveques_docteurs' } } };
  const local = { saints: { augustin: { categorie: 'AUTRE' }, 'maximilien-kolbe': { categorie: 'martyrs' } } };
  const m = fusionnerCatalogue(reference, local);
  assert.equal(m.saints.augustin.categorie, 'eveques_docteurs', 'la référence prime');
  assert.ok(m.saints['maximilien-kolbe'], 'le local ajouté est présent');
  assert.deepEqual(m.bases, { x: {} });
});

test('fusionnerCatalogue tolère une extension locale vide ou absente', () => {
  const reference = { saints: { a: {} } };
  assert.deepEqual(fusionnerCatalogue(reference, null).saints, { a: {} });
  assert.deepEqual(fusionnerCatalogue(reference, { saints: {} }).saints, { a: {} });
});

test('trouverEquivalent : détecte le même saint sous un autre id (même cat./année, nom recoupé)', () => {
  // Le cas réel : « Saint Laurent » †258 déjà en base, ajout de « Saint Laurent de Rome » †258.
  const reference = { laurent: { categorie: 'martyrs', annusNatalis: 258, prenoms: ['laurent', 'lorenzo'], i18n: { fr: { nom: 'Saint Laurent' } } } };
  const nouveau = { categorie: 'martyrs', annusNatalis: 258, prenoms: ['laurent', 'laurent de rome'], i18n: { fr: { nom: 'Saint Laurent de Rome' } } };
  assert.equal(trouverEquivalent(reference, nouveau), 'laurent');
});

test('trouverEquivalent : catégorie ou année différente => pas d\'équivalent', () => {
  const reference = { laurent: { categorie: 'martyrs', annusNatalis: 258, prenoms: ['laurent'], i18n: { fr: { nom: 'Saint Laurent' } } } };
  assert.equal(trouverEquivalent(reference, { categorie: 'martyrs', annusNatalis: 999, prenoms: ['laurent'], i18n: { fr: { nom: 'Saint Laurent' } } }), null);
  assert.equal(trouverEquivalent(reference, { categorie: 'laics', annusNatalis: 258, prenoms: ['laurent'], i18n: { fr: { nom: 'Saint Laurent' } } }), null);
});

test('trouverEquivalent : noms distincts de même catégorie/année => pas d\'équivalent (pas de faux positif)', () => {
  const reference = { laurent: { categorie: 'martyrs', annusNatalis: 258, prenoms: ['laurent'], i18n: { fr: { nom: 'Saint Laurent' } } } };
  // Cyprien †258 est aussi un martyr, mais ce n'est pas le même saint.
  assert.equal(trouverEquivalent(reference, { categorie: 'martyrs', annusNatalis: 258, prenoms: ['cyprien'], i18n: { fr: { nom: 'Saint Cyprien' } } }), null);
  // « Laurentine » ne doit pas être confondue avec « Laurent » (préfixe-mot, pas sous-chaîne).
  assert.equal(trouverEquivalent(reference, { categorie: 'martyrs', annusNatalis: 258, prenoms: ['laurentine'], i18n: { fr: { nom: 'Sainte Laurentine' } } }), null);
});

test('trouverEquivalent : sans annus natalis connu, on s\'abstient (signal trop faible)', () => {
  const reference = { x: { categorie: 'laics', annusNatalis: null, prenoms: ['jean'], i18n: { fr: { nom: 'Saint Jean' } } } };
  assert.equal(trouverEquivalent(reference, { categorie: 'laics', annusNatalis: null, prenoms: ['jean'], i18n: { fr: { nom: 'Saint Jean' } } }), null);
});
