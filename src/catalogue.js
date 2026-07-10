// Accès au catalogue local : résolution de la litanie de base, d'un saint par
// id, et recherche de candidats par prénom (avec désambiguïsation).
//
// Le catalogue est l'unique source de données du site. Fonctions pures :
// elles prennent l'objet `catalogue` (data/catalogue.json) en paramètre.

import { normaliser } from './litanie.js';
import { comparerPreseance } from './precedence.js';

// Construit l'entrée affichable/insérable d'un saint du catalogue.
export function infoSaint(catalogue, id, langue = 'fr') {
  const s = catalogue.saints[id];
  if (!s) return null;
  const i18n = s.i18n[langue] || s.i18n.fr;
  return {
    saintId: id,
    invocation: i18n.nom,
    qualite: i18n.qualite,
    categorie: s.categorie,
    sexe: s.sexe,
    annusNatalis: s.annusNatalis,
    type: s.type,
    feteJour: s.feteJour,
    region: s.region,
    source: s.source || null, // 'nominis' = ajouté via le web, donc corrigeable
    url: s.url || null,
  };
}

// La litanie de base, résolue dans la langue voulue : tableau d'entrées prêtes
// pour le moteur d'insertion. Les invocations fixes (non nominatives) gardent
// leur texte et sont marquées `fixe`.
// Liste des litanies de départ disponibles : [{ cle, nom }] dans l'ordre.
export function listerBases(catalogue) {
  return Object.entries(catalogue.bases).map(([cle, b]) => ({ cle, nom: b.nom }));
}

// La litanie de départ choisie (par clé), résolue dans la langue voulue.
export function entreesBase(catalogue, cleBase = catalogue.baseParDefaut, langue = 'fr') {
  const modele = catalogue.bases[cleBase] || catalogue.bases[catalogue.baseParDefaut];
  return modele.entrees.map((e) => {
    if (e.saint) {
      const info = infoSaint(catalogue, e.saint, langue);
      if (e.epingleFin) info.epingleFin = true;
      return info;
    }
    return {
      saintId: null,
      invocation: typeof e.invocation === 'string' ? e.invocation : e.invocation[langue] || e.invocation.fr,
      categorie: e.categorie,
      sexe: e.sexe || 'M',
      annusNatalis: e.annusNatalis ?? null,
      type: 'saint',
      fixe: true,
      couvre: e.couvre,
    };
  });
}

// Recherche les saints correspondant à un prénom. Renvoie une liste triée par
// préséance (donc regroupée par catégorie, puis par ancienneté), chaque élément
// étant une info-saint enrichie d'un `score` de pertinence.
//   - score 3 : un alias égale exactement le prénom saisi
//   - score 2 : un alias commence par le prénom saisi
//   - score 1 : le nom contient le prénom saisi
export function chercherCandidats(catalogue, requete, langue = 'fr') {
  const q = normaliser(requete);
  if (!q) return [];
  const resultats = [];
  for (const [id, s] of Object.entries(catalogue.saints)) {
    const alias = (s.prenoms || []).map(normaliser);
    let score = 0;
    if (alias.includes(q)) score = 3;
    else if (alias.some((a) => a.startsWith(q))) score = 2;
    else if (normaliser((s.i18n[langue] || s.i18n.fr).nom).includes(q)) score = 1;
    if (score > 0) {
      resultats.push({ ...infoSaint(catalogue, id, langue), score });
    }
  }
  // Tri : pertinence décroissante d'abord, puis ordre de préséance.
  resultats.sort((a, b) => (b.score - a.score) || comparerPreseance(a, b));
  return resultats;
}

// Libellé court de désambiguïsation : « qualité · siècle · région ».
export function descriptionCandidat(saint) {
  const morceaux = [];
  if (saint.qualite) morceaux.push(saint.qualite);
  if (saint.annusNatalis) morceaux.push(siecle(saint.annusNatalis));
  if (saint.region) morceaux.push(saint.region);
  return morceaux.join(' · ');
}

// Siècle en chiffres romains à partir d'une année (ex. 430 -> « Ve s. »).
export function siecle(annee) {
  if (!Number.isFinite(annee)) return '';
  const s = Math.floor((annee - 1) / 100) + 1;
  return `${romain(s)}ᵉ s.`;
}

function romain(n) {
  const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let r = '';
  for (const [v, sym] of table) while (n >= v) { r += sym; n -= v; }
  return r;
}
