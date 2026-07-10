import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parserFichePrenom, trouverUrlPrenom } from '../outils/enrichir-nominis.js';

// Régression : un slug d'URL avec un « % » mal formé faisait lever
// « URI malformed » (decodeURIComponent) et échouer toute la recherche nominis.
// Le décodage doit désormais être tolérant (retour à la forme brute).

test('parserFichePrenom tolère un slug mal encodé (pas de « URI malformed »)', () => {
  const html = '<a href="/contenus/saint/123/Saint-Fo%o.html"><h5>Foo</h5><p>martyr (+ 250)</p></a>';
  let candidats;
  assert.doesNotThrow(() => { candidats = parserFichePrenom(html); });
  assert.equal(candidats.length, 1);
  assert.equal(candidats[0].type, 'saint');
  assert.equal(candidats[0].categorie, 'martyrs');
});

test('trouverUrlPrenom tolère un slug mal encodé', () => {
  const html = '<a href="/contenus/prenom/1/Fo%o.html">x</a>';
  // Le slug brut « Fo%o » ne correspond pas au prénom « foo » : pas de crash, pas de match.
  assert.doesNotThrow(() => trouverUrlPrenom(html, 'foo'));
  assert.equal(trouverUrlPrenom(html, 'foo'), null);
});

test('parserFichePrenom décode toujours correctement un slug bien encodé', () => {
  const html = '<a href="/contenus/saint/9/Sainte-Th%C3%A9r%C3%A8se.html"><h5>Thérèse</h5><p>vierge (+ 1897)</p></a>';
  const [c] = parserFichePrenom(html);
  assert.equal(c.type, 'saint');
  assert.equal(c.sexe, 'F');
});
