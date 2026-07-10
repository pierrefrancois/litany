// Cœur du moteur : insertion d'un saint patron dans la litanie de base, au bon
// rang de préséance, sans créer de doublon.

import {
  CATEGORIES_FIGEES,
  comparerIntraCategorie,
  sectionDe,
} from './precedence.js';

// Normalise un prénom/nom pour la comparaison et la recherche en base :
// minuscules, sans accents, sans ponctuation parasite.
export function normaliser(texte) {
  return (texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlève les accents
    .toLowerCase()
    .replace(/^(saint|sainte|st|ste|bx|bse|bienheureux|bienheureuse)\s+/i, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Identité d'un saint pour la déduplication : son saintId explicite sinon son
// nom normalisé.
function identite(saint) {
  return saint.saintId || normaliser(saint.nom || saint.invocation);
}

// Construit la litanie complète à partir de la liste de base et d'une liste de
// patrons à insérer. Ne mute pas les entrées d'origine.
//
// Options :
//   - opts.grouper (booléen, défaut false) : active l'étape de regroupement des
//     saints en invocations jointes (cf. appliquerGroupes).
//   - opts.groupes (tableau, défaut []) : définition des groupes à appliquer.
//   - opts.langue (chaîne, défaut 'fr') : langue de l'invocation jointe.
//
// Retourne { entrees, doublons, ajouts } :
//   - entrees : la litanie ordonnée (chaque élément a un champ `insere:boolean`)
//   - doublons : patrons ignorés car déjà présents
//   - ajouts  : patrons réellement insérés
export function construireLitanie(base, patrons = [], opts = {}) {
  const entrees = base.map((e) => ({ ...e, insere: false }));
  // Une entrée peut « couvrir » plusieurs saintId (ex. la ligne « Saint Pierre
  // et saint Paul » couvre pierre et paul) : on les marque tous présents.
  const presents = new Set();
  for (const e of entrees) {
    presents.add(identite(e));
    if (e.couvre) for (const id of e.couvre) presents.add(id);
  }
  const doublons = [];
  const ajouts = [];

  for (const brut of patrons) {
    const patron = { ...brut, type: brut.type || 'saint', insere: true };
    const id = identite(patron);

    if (presents.has(id)) {
      doublons.push(patron);
      continue;
    }
    presents.add(id);
    insererUnPatron(entrees, patron, opts);
    ajouts.push(patron);
  }

  // Étape optionnelle de regroupement : après avoir composé la litanie, on peut
  // fusionner certains ensembles de saints en une seule invocation jointe. On ne
  // touche à `entrees` que si l'option est explicitement active et qu'au moins
  // un groupe est défini ; la signature de retour reste inchangée.
  let entreesFinales = entrees;
  if (opts.grouper && opts.groupes && opts.groupes.length > 0) {
    entreesFinales = appliquerGroupes(entrees, opts.groupes, opts);
  }

  return { entrees: entreesFinales, doublons, ajouts };
}

// Regroupe des saints en une invocation jointe si TOUS les membres du groupe
// sont présents ; l'entrée jointe prend le rang du membre le mieux placé (le
// plus petit index) et couvre (via `couvre`) tous ses membres.
//
// Fonction pure : ne mute pas le tableau reçu, elle travaille sur une copie et
// la renvoie. Les groupes sont appliqués séquentiellement (le résultat d'un
// groupe sert d'entrée au suivant). Chaque groupe a la forme
// { cle, membres: [saintId...], i18n: { fr: { invocation } } }.
export function appliquerGroupes(entrees, groupes, opts = {}) {
  const langue = opts.langue || 'fr';
  let sortie = [...entrees];

  for (const groupe of groupes) {
    const idsMembres = new Set(groupe.membres);
    // On n'agit que si CHAQUE membre du groupe a une entrée correspondante.
    const trouves = groupe.membres.filter((m) =>
      sortie.some((e) => identite(e) === m),
    );
    if (trouves.length !== groupe.membres.length) continue; // pas tous présents

    // `premier` (l'entrée la mieux placée d'un membre) sert de gabarit de
    // préséance : on hérite de sa catégorie/sexe/année pour le tri.
    const premier = sortie.find((e) => idsMembres.has(identite(e)));
    // L'entrée jointe est marquée « insérée » dès qu'un seul membre l'était.
    const insere = sortie.some(
      (e) => idsMembres.has(identite(e)) && e.insere,
    );
    const jointe = {
      invocation: (groupe.i18n[langue] || groupe.i18n.fr).invocation,
      categorie: premier.categorie,
      sexe: premier.sexe,
      anneeDeces: premier.anneeDeces,
      type: 'saint',
      couvre: [...groupe.membres],
      insere,
      groupe: true,
    };

    // On reconstruit le tableau : la PREMIÈRE occurrence d'un membre est
    // remplacée par l'entrée jointe (elle prend donc le rang du mieux placé),
    // les autres membres sont simplement omis. Ainsi pas de calcul d'index
    // fragile ni de décalage à gérer.
    let posee = false;
    sortie = sortie.flatMap((e) => {
      if (!idsMembres.has(identite(e))) return [e];
      if (!posee) {
        posee = true;
        return [jointe];
      }
      return [];
    });
  }

  return sortie;
}

// Insère un patron dans le tableau `entrees` (muté) à la bonne position, selon
// la SECTION (qui dépend du mode `bienheureuxALaFin`). Par défaut un bienheureux
// se place « suis locis » dans sa catégorie ; en mode « à la fin » il rejoint le
// second étage des bienheureux.
function insererUnPatron(entrees, patron, opts) {
  const sp = sectionDe(patron, opts);
  const indices = [];
  for (let i = 0; i < entrees.length; i++) {
    if (sectionDe(entrees[i], opts).cle === sp.cle) indices.push(i);
  }

  // Section absente : on place le patron selon le RANG de section, avant la
  // première entrée d'une section de rang supérieur.
  if (indices.length === 0) {
    for (let i = 0; i < entrees.length; i++) {
      if (sectionDe(entrees[i], opts).rang > sp.rang) {
        entrees.splice(i, 0, patron);
        return;
      }
    }
    entrees.push(patron);
    return;
  }

  // Catégorie à ordre figé, côté saints (Marie, anges, patriarches, apôtres) :
  // on ajoute en fin de section, mais AVANT les entrées épinglées (ex. Joseph).
  if (CATEGORIES_FIGEES.has(patron.categorie) && patron.type !== 'bienheureux') {
    let pos = indices[indices.length - 1] + 1;
    for (let k = indices.length - 1; k >= 0; k--) {
      if (entrees[indices[k]].epingleFin) pos = indices[k];
      else break;
    }
    entrees.splice(pos, 0, patron);
    return;
  }

  // Cas général : première entrée de la section qui DOIT venir après le patron
  // (hommes avant femmes, puis date de mort).
  for (const i of indices) {
    if (comparerIntraCategorie(entrees[i], patron) > 0) {
      entrees.splice(i, 0, patron);
      return;
    }
  }
  entrees.splice(indices[indices.length - 1] + 1, 0, patron);
}
