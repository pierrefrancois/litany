// Rendu de la litanie en texte / structure affichable.
import { sectionDe } from './precedence.js';

// La litanie du baptême des petits enfants se conclut par cette invocation
// englobante (rubrique : on ajoute les patrons juste avant).
export const CONCLUSION = [
  'Tous les saints et saintes de Dieu, priez pour nous.',
];

// Transforme la liste d'entrées en blocs (titres de section + invocations),
// en terminant par l'invocation de conclusion. Source unique du rendu.
// `opts.bienheureuxALaFin` change le découpage en sections (et donc les titres).
export function enBlocs(entrees, opts = {}) {
  const blocs = [];
  // Un bandeau n'est affiché qu'à sa PREMIÈRE occurrence : à la Vigile pascale,
  // le Missel sépare les docteurs (Catherine/Thérèse en fin), ce qui ferait
  // sinon réapparaître « Évêques et docteurs ».
  const sectionsVues = new Set();
  for (const e of entrees) {
    const sec = sectionDe(e, opts);
    if (!sectionsVues.has(sec.cle)) {
      sectionsVues.add(sec.cle);
      blocs.push({ type: 'titre', texte: sec.libelle });
    }
    blocs.push({
      type: 'invocation',
      texte: `${e.invocation || e.nom}, priez pour nous.`,
      insere: !!e.insere,
    });
  }
  for (const c of CONCLUSION) blocs.push({ type: 'invocation', texte: c, conclusion: true });
  return blocs;
}

// Rendu texte brut (pour copier-coller / impression simple).
export function enTexte(entrees, { titres = true, bienheureuxALaFin = false } = {}) {
  const lignes = [];
  for (const b of enBlocs(entrees, { bienheureuxALaFin })) {
    if (b.type === 'titre') {
      if (titres) lignes.push('', `— ${b.texte} —`);
    } else {
      lignes.push(b.texte);
    }
  }
  return lignes.join('\n').trim();
}
