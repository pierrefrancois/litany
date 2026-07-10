// Construit data/catalogue.json à partir d'une table compacte.
// Source unique = base locale (cf. décision projet : nominis et le Martyrologe
// romain ne servent QU'en enrichissement hors-ligne, jamais à l'exécution).
//
// Le catalogue est prêt pour le multilingue : les champs de préséance
// (categorie, sexe, anneeDeces, type) sont indépendants de la langue ; seul
// l'affichage (nom, qualité) est traduisible (ici : fr seulement).
//
// Usage : node outils/build-catalogue.mjs

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Colonnes : id, catégorie, sexe, annéeDécès, type, fête(MM-JJ|null), région|null, qualité(fr), nom(fr), alias(prénoms)
const T = [
  // — Vierge Marie —
  ['marie', 'marie', 'F', null, 'saint', '01-01', null, 'Mère de Dieu', 'Sainte Marie, Mère de Dieu', ['marie', 'maria', 'mary', 'myriam']],

  // — Anges —
  ['michel', 'anges', 'M', null, 'saint', '09-29', null, 'archange', 'Saint Michel', ['michel', 'mickael', 'mikael', 'michael']],
  ['gabriel', 'anges', 'M', null, 'saint', '09-29', null, 'archange', 'Saint Gabriel', ['gabriel']],
  ['raphael', 'anges', 'M', null, 'saint', '09-29', null, 'archange', 'Saint Raphaël', ['raphael']],

  // — Patriarches et prophètes —
  ['abraham', 'patriarches_prophetes', 'M', null, 'saint', null, null, 'patriarche', 'Saint Abraham', ['abraham']],
  ['moise', 'patriarches_prophetes', 'M', null, 'saint', null, null, 'prophète', 'Saint Moïse', ['moise']],
  ['elie', 'patriarches_prophetes', 'M', null, 'saint', null, null, 'prophète', 'Saint Élie', ['elie']],
  ['jean-baptiste', 'patriarches_prophetes', 'M', 30, 'saint', '06-24', null, 'précurseur du Seigneur', 'Saint Jean-Baptiste', ['jean', 'jean-baptiste', 'jean baptiste']],
  ['joseph', 'patriarches_prophetes', 'M', null, 'saint', '03-19', null, 'époux de la Vierge Marie', 'Saint Joseph', ['joseph', 'jose']],

  // — Apôtres et disciples —
  ['pierre', 'apotres', 'M', 64, 'saint', '06-29', null, 'apôtre', 'Saint Pierre', ['pierre', 'peter', 'pierre']],
  ['paul', 'apotres', 'M', 67, 'saint', '06-29', null, 'apôtre des nations', 'Saint Paul', ['paul', 'paolo']],
  ['andre', 'apotres', 'M', 60, 'saint', '11-30', null, 'apôtre', 'Saint André', ['andre']],
  ['jacques-majeur', 'apotres', 'M', 44, 'saint', '07-25', null, 'apôtre', 'Saint Jacques le Majeur', ['jacques', 'jacky']],
  ['jean', 'apotres', 'M', 100, 'saint', '12-27', null, 'apôtre et évangéliste', 'Saint Jean', ['jean']],
  ['thomas', 'apotres', 'M', 72, 'saint', '07-03', null, 'apôtre', 'Saint Thomas', ['thomas']],
  ['jacques-mineur', 'apotres', 'M', 62, 'saint', '05-03', null, 'apôtre', 'Saint Jacques le Mineur', ['jacques']],
  ['philippe', 'apotres', 'M', 80, 'saint', '05-03', null, 'apôtre', 'Saint Philippe', ['philippe']],
  ['barthelemy', 'apotres', 'M', 71, 'saint', '08-24', null, 'apôtre', 'Saint Barthélemy', ['barthelemy']],
  ['matthieu', 'apotres', 'M', 70, 'saint', '09-21', null, 'apôtre et évangéliste', 'Saint Matthieu', ['matthieu', 'mathieu']],
  ['simon', 'apotres', 'M', 100, 'saint', '10-28', null, 'apôtre', 'Saint Simon', ['simon']],
  ['jude', 'apotres', 'M', 80, 'saint', '10-28', null, 'apôtre', 'Saint Jude', ['jude', 'thaddee']],
  ['matthias', 'apotres', 'M', 80, 'saint', '05-14', null, 'apôtre', 'Saint Matthias', ['matthias']],
  ['barnabe', 'apotres', 'M', 61, 'saint', '06-11', null, 'apôtre', 'Saint Barnabé', ['barnabe']],
  ['luc', 'apotres', 'M', 84, 'saint', '10-18', null, 'évangéliste', 'Saint Luc', ['luc', 'lucas']],
  ['marc', 'apotres', 'M', 68, 'saint', '04-25', null, 'évangéliste', 'Saint Marc', ['marc', 'marco']],
  ['marie-madeleine', 'apotres', 'F', 70, 'saint', '07-22', null, 'disciple du Seigneur', 'Sainte Marie-Madeleine', ['madeleine', 'marie-madeleine', 'marie madeleine', 'magali']],

  // — Martyrs —
  ['etienne', 'martyrs', 'M', 35, 'saint', '12-26', null, 'premier martyr', 'Saint Étienne', ['etienne', 'stephane', 'stephen']],
  ['clement-rome', 'martyrs', 'M', 101, 'saint', '11-23', null, 'pape et martyr', 'Saint Clément', ['clement']],
  ['ignace-antioche', 'martyrs', 'M', 107, 'saint', '10-17', null, 'évêque et martyr', "Saint Ignace d'Antioche", ['ignace']],
  ['polycarpe', 'martyrs', 'M', 155, 'saint', '02-23', null, 'évêque et martyr', 'Saint Polycarpe', ['polycarpe']],
  ['blandine', 'martyrs', 'F', 177, 'saint', '06-02', 'Lyon', 'martyre de Lyon', 'Sainte Blandine', ['blandine']],
  ['perpetue', 'martyrs', 'F', 203, 'saint', '03-07', null, 'martyre', 'Sainte Perpétue', ['perpetue']],
  ['felicite', 'martyrs', 'F', 203, 'saint', '03-07', null, 'martyre', 'Sainte Félicité', ['felicite']],
  ['cecile', 'martyrs', 'F', 230, 'saint', '11-22', null, 'vierge et martyre', 'Sainte Cécile', ['cecile']],
  ['corneille', 'martyrs', 'M', 253, 'saint', '09-16', null, 'pape et martyr', 'Saint Corneille', ['corneille']],
  ['agathe', 'martyrs', 'F', 251, 'saint', '02-05', null, 'vierge et martyre', 'Sainte Agathe', ['agathe']],
  ['cyprien', 'martyrs', 'M', 258, 'saint', '09-16', null, 'évêque et martyr', 'Saint Cyprien', ['cyprien']],
  ['laurent', 'martyrs', 'M', 258, 'saint', '08-10', null, 'diacre et martyr', 'Saint Laurent', ['laurent', 'lorenzo']],
  ['come', 'martyrs', 'M', 287, 'saint', '09-26', null, 'martyr', 'Saint Côme', ['come', 'cosme']],
  ['damien', 'martyrs', 'M', 287, 'saint', '09-26', null, 'martyr', 'Saint Damien', ['damien']],
  ['sebastien', 'martyrs', 'M', 288, 'saint', '01-20', null, 'martyr', 'Saint Sébastien', ['sebastien']],
  ['georges', 'martyrs', 'M', 303, 'saint', '04-23', null, 'martyr', 'Saint Georges', ['georges', 'georg']],
  ['agnes', 'martyrs', 'F', 304, 'saint', '01-21', null, 'vierge et martyre', 'Sainte Agnès', ['agnes', 'ines']],
  ['lucie', 'martyrs', 'F', 304, 'saint', '12-13', null, 'vierge et martyre', 'Sainte Lucie', ['lucie', 'lucia', 'lucy']],
  ['marguerite', 'martyrs', 'F', 304, 'saint', '07-20', null, 'vierge et martyre', 'Sainte Marguerite', ['marguerite', 'margaux', 'margot']],
  ['catherine-alexandrie', 'martyrs', 'F', 305, 'saint', '11-25', null, "vierge et martyre d'Alexandrie", "Sainte Catherine d'Alexandrie", ['catherine', 'katia', 'karine']],

  // — Évêques et docteurs —
  ['nicolas', 'eveques_docteurs', 'M', 343, 'saint', '12-06', null, 'évêque de Myre', 'Saint Nicolas', ['nicolas', 'colin']],
  ['hilaire', 'eveques_docteurs', 'M', 367, 'saint', '01-13', null, 'évêque et docteur', 'Saint Hilaire', ['hilaire']],
  ['athanase', 'eveques_docteurs', 'M', 373, 'saint', '05-02', null, 'évêque et docteur', 'Saint Athanase', ['athanase']],
  ['basile', 'eveques_docteurs', 'M', 379, 'saint', '01-02', null, 'évêque et docteur', 'Saint Basile le Grand', ['basile']],
  ['gregoire-naziance', 'eveques_docteurs', 'M', 390, 'saint', '01-02', null, 'évêque et docteur', 'Saint Grégoire de Nazianze', ['gregoire']],
  ['martin', 'eveques_docteurs', 'M', 397, 'saint', '11-11', 'Tours', 'évêque de Tours', 'Saint Martin', ['martin']],
  ['ambroise', 'eveques_docteurs', 'M', 397, 'saint', '12-07', null, 'évêque et docteur', 'Saint Ambroise', ['ambroise']],
  ['jean-chrysostome', 'eveques_docteurs', 'M', 407, 'saint', '09-13', null, 'évêque et docteur', 'Saint Jean Chrysostome', ['jean']],
  ['jerome', 'eveques_docteurs', 'M', 420, 'saint', '09-30', null, 'prêtre et docteur', 'Saint Jérôme', ['jerome']],
  ['augustin', 'eveques_docteurs', 'M', 430, 'saint', '08-28', null, "évêque d'Hippone, docteur", 'Saint Augustin', ['augustin']],
  ['leon', 'eveques_docteurs', 'M', 461, 'saint', '11-10', null, 'pape et docteur', 'Saint Léon le Grand', ['leon']],
  ['gregoire-grand', 'eveques_docteurs', 'M', 604, 'saint', '09-03', null, 'pape et docteur', 'Saint Grégoire le Grand', ['gregoire']],
  ['thomas-aquin', 'eveques_docteurs', 'M', 1274, 'saint', '01-28', null, 'prêtre et docteur', "Saint Thomas d'Aquin", ['thomas']],
  ['catherine-sienne', 'eveques_docteurs', 'F', 1380, 'saint', '04-29', 'Sienne', 'vierge et docteur', 'Sainte Catherine de Sienne', ['catherine']],
  ['therese-avila', 'eveques_docteurs', 'F', 1582, 'saint', '10-15', 'Avila', 'vierge et docteur', "Sainte Thérèse d'Avila", ['therese', 'theresa']],
  ['francois-sales', 'eveques_docteurs', 'M', 1622, 'saint', '01-24', null, 'évêque et docteur', 'Saint François de Sales', ['francois']],

  // — Prêtres et religieux —
  ['antoine-ermite', 'pretres_religieux', 'M', 356, 'saint', '01-17', null, 'abbé, père des moines', 'Saint Antoine le Grand', ['antoine']],
  ['benoit', 'pretres_religieux', 'M', 547, 'saint', '07-11', null, 'abbé, patriarche des moines', 'Saint Benoît', ['benoit', 'ben']],
  ['bernard', 'pretres_religieux', 'M', 1153, 'saint', '08-20', null, 'abbé et docteur', 'Saint Bernard de Clairvaux', ['bernard']],
  ['dominique', 'pretres_religieux', 'M', 1221, 'saint', '08-08', null, 'fondateur des Prêcheurs', 'Saint Dominique', ['dominique', 'dominic']],
  ['francois-assise', 'pretres_religieux', 'M', 1226, 'saint', '10-04', 'Assise', 'fondateur des Frères mineurs', "Saint François d'Assise", ['francois']],
  ['antoine-padoue', 'pretres_religieux', 'M', 1231, 'saint', '06-13', 'Padoue', 'prêtre et docteur', 'Saint Antoine de Padoue', ['antoine']],
  ['claire', 'pretres_religieux', 'F', 1253, 'saint', '08-11', 'Assise', 'vierge, fondatrice', "Sainte Claire d'Assise", ['claire', 'clara']],
  ['francois-xavier', 'pretres_religieux', 'M', 1552, 'saint', '12-03', null, 'prêtre, missionnaire', 'Saint François Xavier', ['francois', 'xavier']],
  ['ignace-loyola', 'pretres_religieux', 'M', 1556, 'saint', '07-31', null, 'fondateur des Jésuites', 'Saint Ignace de Loyola', ['ignace']],
  ['camille', 'pretres_religieux', 'M', 1614, 'saint', '07-14', null, 'prêtre, fondateur', 'Saint Camille de Lellis', ['camille']],
  ['vincent-paul', 'pretres_religieux', 'M', 1660, 'saint', '09-27', null, 'prêtre, fondateur', 'Saint Vincent de Paul', ['vincent']],
  ['jb-de-la-salle', 'pretres_religieux', 'M', 1719, 'saint', '04-07', null, 'prêtre, fondateur des écoles', 'Saint Jean-Baptiste de la Salle', ['jean', 'jean-baptiste']],
  ['vianney', 'pretres_religieux', 'M', 1859, 'saint', '08-04', 'Ars', "prêtre, curé d'Ars", 'Saint Jean-Marie Vianney', ['jean', 'jean-marie']],
  ['bernadette', 'pretres_religieux', 'F', 1879, 'saint', '04-16', 'Lourdes', 'vierge, voyante de Lourdes', 'Sainte Bernadette Soubirous', ['bernadette']],
  ['jean-bosco', 'pretres_religieux', 'M', 1888, 'saint', '01-31', null, 'prêtre, fondateur des Salésiens', 'Saint Jean Bosco', ['jean', 'bosco']],
  ['therese-lisieux', 'pretres_religieux', 'F', 1897, 'saint', '10-01', 'Lisieux', "vierge et docteur", "Sainte Thérèse de l'Enfant-Jésus", ['therese']],
  ['charles-foucauld', 'pretres_religieux', 'M', 1916, 'saint', '12-01', 'Sahara', 'prêtre, ermite au Sahara', 'Saint Charles de Foucauld', ['charles']],

  // — Laïcs —
  ['anne', 'laics', 'F', 12, 'saint', '07-26', null, 'mère de la Vierge Marie', 'Sainte Anne', ['anne', 'anna', 'annie', 'nancy']],
  ['helene', 'laics', 'F', 330, 'saint', '08-18', null, 'impératrice', 'Sainte Hélène', ['helene', 'helena']],
  ['monique', 'laics', 'F', 387, 'saint', '08-27', null, 'mère de saint Augustin', 'Sainte Monique', ['monique']],
  ['louis', 'laics', 'M', 1270, 'saint', '08-25', 'France', 'roi de France', 'Saint Louis', ['louis', 'ludovic']],
  ['elisabeth-hongrie', 'laics', 'F', 1231, 'saint', '11-17', 'Hongrie', 'mère de famille, tertiaire', 'Sainte Élisabeth de Hongrie', ['elisabeth', 'betty', 'isabelle', 'isabel', 'babeth']],
  ['elisabeth-portugal', 'laics', 'F', 1336, 'saint', '07-04', 'Portugal', 'reine de Portugal', 'Sainte Élisabeth de Portugal', ['elisabeth', 'isabelle', 'isabel']],
  ['jeanne-arc', 'laics', 'F', 1431, 'saint', '05-30', 'France', 'vierge, patronne de la France', "Sainte Jeanne d'Arc", ['jeanne', 'jane']],
];

// Litanies de DÉPART proposées. Chaque entrée : chaîne = id du catalogue ;
// objet = invocation fixe ou référence avec options :
//   - epingleFin : reste en fin de sa catégorie (Joseph clôt les prophètes)
//   - couvre     : saintId déjà présents que cette ligne combinée représente (dédup)
const ANGES = { invocation: 'Vous tous, saints anges de Dieu', categorie: 'anges' };
const PIERRE_PAUL = { invocation: 'Saint Pierre et saint Paul', categorie: 'apotres', sexe: 'M', anneeDeces: 64, couvre: ['pierre', 'paul'] };
const JOSEPH = { saint: 'joseph', epingleFin: true };

const BASES = {
  // Rituel du baptême des petits enfants (forme ordinaire) — liste par défaut.
  'bapteme-enfants': {
    nom: 'Baptême des petits enfants',
    entrees: ['marie', 'jean-baptiste', JOSEPH, PIERRE_PAUL],
  },
  // Vigile pascale — liste abrégée du Missel romain (avant la bénédiction de
  // l'eau baptismale). Ordre fidèle au Missel (Catherine et Thérèse en fin).
  'vigile-pascale': {
    nom: 'Vigile pascale',
    entrees: [
      'marie', 'michel', ANGES, 'jean-baptiste', JOSEPH, PIERRE_PAUL,
      'andre', 'jean', 'marie-madeleine',
      'etienne', 'ignace-antioche', 'laurent',
      { invocation: 'Sainte Perpétue et sainte Félicité', categorie: 'martyrs', sexe: 'F', anneeDeces: 203, couvre: ['perpetue', 'felicite'] },
      'agnes',
      'gregoire-grand', 'augustin', 'athanase', 'basile', 'martin',
      'benoit',
      { invocation: 'Saint François et saint Dominique', categorie: 'pretres_religieux', sexe: 'M', anneeDeces: 1221, couvre: ['francois-assise', 'dominique'] },
      'ignace-loyola', 'francois-xavier', 'vianney',
      'catherine-sienne', 'therese-avila',
    ],
  },
  // Litanie complète (traditionnelle), saints listés individuellement.
  'complete': {
    nom: 'Litanie complète',
    entrees: [
      'marie', { invocation: 'Sainte Vierge des vierges', categorie: 'marie' },
      'michel', 'gabriel', 'raphael', ANGES,
      'abraham', 'moise', 'elie', 'jean-baptiste', JOSEPH,
      'pierre', 'paul', 'andre', 'jacques-majeur', 'jean', 'thomas', 'jacques-mineur',
      'philippe', 'barthelemy', 'matthieu', 'simon', 'jude', 'matthias', 'barnabe',
      'luc', 'marc', 'marie-madeleine',
      'etienne', 'ignace-antioche', 'polycarpe', 'corneille', 'cyprien', 'laurent',
      'sebastien', 'perpetue', 'felicite', 'cecile', 'agathe', 'agnes', 'lucie',
      'hilaire', 'athanase', 'basile', 'gregoire-naziance', 'martin', 'ambroise',
      'jean-chrysostome', 'jerome', 'augustin', 'leon', 'gregoire-grand',
      'thomas-aquin', 'francois-sales', 'catherine-sienne', 'therese-avila',
      'antoine-ermite', 'benoit', 'bernard', 'dominique', 'francois-assise',
      'ignace-loyola', 'francois-xavier', 'vianney', 'jean-bosco', 'therese-lisieux',
      'anne', 'monique', 'helene', 'louis', 'elisabeth-hongrie', 'jeanne-arc',
    ],
  },
};
const baseParDefaut = 'bapteme-enfants';

const saints = {};
for (const [id, categorie, sexe, anneeDeces, type, feteJour, region, qualite, nom, prenoms] of T) {
  if (saints[id]) throw new Error(`id dupliqué : ${id}`);
  saints[id] = {
    categorie, sexe, anneeDeces, type, feteJour, region,
    prenoms,
    i18n: { fr: { nom, qualite } },
  };
}

// Résout et valide une liste d'entrées (vérifie l'existence des id).
function resoudre(entrees, cle) {
  return entrees.map((e) => {
    if (typeof e === 'string') {
      if (!saints[e]) throw new Error(`base « ${cle} » référence un id absent : ${e}`);
      return { saint: e };
    }
    if (e.saint && !saints[e.saint]) throw new Error(`base « ${cle} » : id absent ${e.saint}`);
    return e;
  });
}

const bases = {};
for (const [cle, { nom, entrees }] of Object.entries(BASES)) {
  bases[cle] = { nom, entrees: resoudre(entrees, cle) };
}

const catalogue = {
  _doc: 'Catalogue local des saints. Source unique du site. Champs de préséance (categorie/sexe/anneeDeces/type) indépendants de la langue ; affichage dans i18n. bases = litanies de départ proposées (id du catalogue ou invocation fixe ; epingleFin/couvre en options) ; baseParDefaut = clé initiale.',
  categories: ['marie', 'anges', 'patriarches_prophetes', 'apotres', 'martyrs', 'eveques_docteurs', 'pretres_religieux', 'laics'],
  baseParDefaut,
  bases,
  saints,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const sortie = join(__dirname, '..', 'data', 'catalogue.json');
await writeFile(sortie, JSON.stringify(catalogue, null, 2) + '\n', 'utf-8');
console.log(`✓ ${sortie}`);
console.log(`  ${Object.keys(saints).length} saints ; bases : ${Object.entries(bases).map(([k, b]) => `${k} (${b.entrees.length})`).join(', ')}`);
