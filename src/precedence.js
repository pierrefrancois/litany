// Règles de préséance de la litanie des saints (rituel romain, Ordo cantus Missae 1972).
//
// Deux niveaux :
//   1. La CATÉGORIE (ordre ci-dessous, de Marie aux laïcs).
//   2. À l'intérieur d'une catégorie : les HOMMES d'abord (ordre chronologique
//      du « dies natalis »), PUIS les FEMMES (même ordre chrono).
//      À catégorie et sexe égaux : un SAINT précède un BIENHEUREUX.
//
// Le critère de départage est le DIES NATALIS, pas la naissance ni la
// canonisation. Exception traditionnelle non automatisable : un fondateur peut
// précéder son disciple (ex. Ignace de Loyola †1556 avant François Xavier †1552) ;
// ce cas est géré « en dur » dans l'ordre de la litanie de base, pas par le tri.

// Ordre des catégories (l'index = le rang de préséance).
export const CATEGORIES = [
  'marie',                 // Sainte Marie, Mère de Dieu
  'anges',                 // Michel, Gabriel, Raphaël, les anges
  'patriarches_prophetes', // Abraham… Jean-Baptiste, et Joseph en dernier
  'apotres',               // Pierre & Paul en tête, … Marie-Madeleine
  'martyrs',               // Étienne, Ignace d'Antioche…
  'eveques_docteurs',      // évêques et docteurs de l'Église
  'pretres_religieux',     // prêtres, moines, fondateurs, religieuses
  'laics',                 // laïcs (rois, mères, vierges non religieuses…)
];

// Libellés lisibles, pour l'affichage des intertitres.
export const LIBELLES_CATEGORIES = {
  marie: 'La Vierge Marie',
  anges: 'Les anges',
  patriarches_prophetes: 'Patriarches et prophètes',
  apotres: 'Apôtres et disciples',
  martyrs: 'Martyrs',
  eveques_docteurs: 'Évêques et docteurs',
  pretres_religieux: 'Prêtres et religieux',
  laics: 'Laïcs',
};

// Catégories à ordre figé : on n'y insère pas par dies natalis, car ce sont des
// ensembles fermés et ordonnés par la liturgie elle-même (canon de la messe pour
// les apôtres, etc.). Un patron qui y tombe et qui n'y figure pas est ajouté en
// fin de catégorie, faute de mieux.
export const CATEGORIES_FIGEES = new Set([
  'marie',
  'anges',
  'patriarches_prophetes',
  'apotres',
]);

export function rangCategorie(categorie) {
  const i = CATEGORIES.indexOf(categorie);
  if (i === -1) throw new Error(`Catégorie inconnue : ${categorie}`);
  return i;
}

// Section d'une entrée (pour le tri, l'insertion et les intertitres).
// Deux modes :
//   - défaut (norme OCM) : la section EST la catégorie ; un bienheureux partage
//     la section de sa catégorie et s'y insère par date (« suis locis »).
//   - bienheureuxALaFin (usage optionnel) : les bienheureux forment un second
//     étage, regroupés après tous les saints, subdivisé par catégorie.
// Renvoie { cle, rang, libelle }.
export function sectionDe(entree, { bienheureuxALaFin = false } = {}) {
  const idx = CATEGORIES.indexOf(entree.categorie);
  const base = idx === -1 ? CATEGORIES.length : idx;
  const libCat = LIBELLES_CATEGORIES[entree.categorie] || entree.categorie;
  if (!bienheureuxALaFin) {
    return { cle: entree.categorie, rang: base, libelle: libCat };
  }
  const bx = entree.type === 'bienheureux';
  return {
    cle: (bx ? 'bx:' : 's:') + entree.categorie,
    rang: base + (bx ? CATEGORIES.length : 0),
    libelle: bx ? `Bienheureux — ${libCat}` : libCat,
  };
}

// Clé de tri d'un saint À L'INTÉRIEUR de sa catégorie, sous forme de tuple
// comparable : [sexe (0=H avant 1=F), annus natalis, type (0=saint avant 1=bx)].
export function cleTriIntraCategorie(saint) {
  const sexe = saint.sexe === 'F' ? 1 : 0;
  const annee = Number.isFinite(saint.annusNatalis) ? saint.annusNatalis : Infinity;
  const type = saint.type === 'bienheureux' ? 1 : 0;
  return [sexe, annee, type];
}

// Compare deux saints d'une MÊME catégorie. < 0 si a précède b.
export function comparerIntraCategorie(a, b) {
  const ka = cleTriIntraCategorie(a);
  const kb = cleTriIntraCategorie(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

// Compare deux entrées selon la préséance complète : catégorie, puis dans la
// catégorie hommes/femmes par dies natalis (les bienheureux ajoutés se placent
// « suis locis », dans leur catégorie, par dies natalis — OCM). À catégorie/sexe/date
// égaux, un saint précède un bienheureux (usage).
export function comparerPreseance(a, b) {
  const ra = rangCategorie(a.categorie);
  const rb = rangCategorie(b.categorie);
  if (ra !== rb) return ra - rb;
  return comparerIntraCategorie(a, b);
}
