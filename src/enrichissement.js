// Fonctions pures de l'enrichissement du catalogue depuis nominis.
// Convertissent un candidat nominis en entrée de catalogue, et fusionnent le
// catalogue de référence avec les saints ajoutés par l'utilisateur (catalogue-local).

import { normaliser } from './litanie.js';

// Identifiant kebab-case à partir d'un nom (l'honorifique est retiré par normaliser).
export function idDepuisNom(nom) {
  return normaliser(nom).replace(/\s+/g, '-') || 'saint';
}

// Transforme le libellé nominis en « qualité » d'affichage : retire le
// « (+ année) », « (VIe siècle) » ou « † … » final.
export function qualiteDepuisLibelle(libelle) {
  return (libelle || '')
    .replace(/\s*[([][^)\]]*[)\]]\s*$/, '')
    .replace(/\s*[+†].*$/, '')
    .trim();
}

// Construit l'entrée de catalogue { id, saint } à partir d'un candidat nominis
// et du prénom recherché (qui devient un alias).
export function saintDepuisCandidat(candidat, prenom) {
  const id = idDepuisNom(candidat.nom);
  const alias = [...new Set([normaliser(prenom), normaliser(candidat.nomCourt || '')].filter(Boolean))];
  return {
    id,
    saint: {
      categorie: candidat.categorie,
      sexe: candidat.sexe,
      anneeDeces: Number.isFinite(candidat.anneeDeces) ? candidat.anneeDeces : null,
      type: candidat.type === 'bienheureux' ? 'bienheureux' : 'saint',
      feteJour: null,
      region: null,
      prenoms: alias,
      i18n: { fr: { nom: candidat.nom, qualite: qualiteDepuisLibelle(candidat.libelle) } },
      source: 'nominis',
      url: candidat.url || null,
    },
  };
}

// Fusionne le catalogue de référence et l'extension locale (saints ajoutés via
// le web). Les saints locaux ne masquent jamais un id déjà présent en référence.
export function fusionnerCatalogue(reference, local) {
  const saintsLocaux = (local && local.saints) || {};
  return {
    ...reference,
    saints: { ...saintsLocaux, ...reference.saints },
  };
}

// Cherche dans un dictionnaire de saints un saint ÉQUIVALENT au saint donné,
// c.-à-d. vraisemblablement la même personne enregistrée sous un autre id :
// même catégorie, même année de mort (connue et identique), et un nom/prénom qui
// se recoupe. Sert à éviter les doublons lors d'un ajout via nominis (ex.
// « Saint Laurent » †258 déjà présent quand on veut ajouter « Saint Laurent de
// Rome » †258). Renvoie l'id équivalent trouvé, sinon null.
export function trouverEquivalent(saints, saint) {
  const aliasDe = (s) => new Set(
    [...(s.prenoms || []).map(normaliser), normaliser(s.i18n?.fr?.nom)].filter(Boolean),
  );
  const cibles = aliasDe(saint);
  // « laurent » est un préfixe-MOT de « laurent de rome », mais pas de
  // « laurentine » : on exige la fin de chaîne ou une espace, pas une simple
  // sous-chaîne, pour éviter les faux positifs.
  const prefixeMot = (court, long) => court === long || long.startsWith(court + ' ');
  for (const [id, s] of Object.entries(saints || {})) {
    if (s.categorie !== saint.categorie) continue;
    const memeAnnee = Number.isFinite(s.anneeDeces)
      && Number.isFinite(saint.anneeDeces)
      && s.anneeDeces === saint.anneeDeces;
    if (!memeAnnee) continue; // sans année commune, signal trop faible : on s'abstient
    const existants = aliasDe(s);
    const recoupe = [...cibles].some((a) =>
      [...existants].some((b) => prefixeMot(a, b) || prefixeMot(b, a)),
    );
    if (recoupe) return id;
  }
  return null;
}
