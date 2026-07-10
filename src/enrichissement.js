// Fonctions pures de l'enrichissement du catalogue depuis nominis.
// Convertissent un candidat nominis en entrée de catalogue, et fusionnent le
// catalogue curé avec les saints ajoutés par l'utilisateur (catalogue-local).

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

// Fusionne le catalogue curé et l'extension locale (saints ajoutés via le web).
// Les saints locaux ne masquent jamais un id déjà curé.
export function fusionnerCatalogue(cure, local) {
  const saintsLocaux = (local && local.saints) || {};
  return {
    ...cure,
    saints: { ...saintsLocaux, ...cure.saints },
  };
}
