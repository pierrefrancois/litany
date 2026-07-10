// Scraping « d'appoint » de nominis.cef.fr : résout un prénom inconnu de la base
// locale vers un saint { nom, categorie, sexe, anneeDeces, type }.
//
// Nominis n'a pas d'API par prénom, mais :
//   1. POST /  (rechercheType=prenom&rechercheValeur=…)  -> page de résultats
//      contenant <a href="/contenus/prenom/<id>/<Slug>.html"> (liste filtrée).
//   2. La fiche prénom liste chaque saint sous la forme
//        <a href="/contenus/saint/<id>/<Honorifique>-<Nom>.html">
//           <h5>Nom</h5><p>qualité&nbsp;(+&nbsp;année)</p></a>
//      -> le SLUG d'URL donne l'honorifique (Saint/Sainte/Bienheureux…) donc le
//         sexe et le type ; le <p> donne la catégorie et le dies natalis.
//
// Extraction heuristique : on renvoie un MEILLEUR CANDIDAT + tous les candidats,
// à confirmer/ajuster côté interface avant insertion.

const BASE = 'https://nominis.cef.fr';
const UA = { 'User-Agent': 'litanie-baptisme/0.1 (usage liturgique)' };

function sansAccents(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function normaliser(s) {
  return sansAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
// Décodage tolérant d'un slug d'URL : certains slugs de nominis contiennent un
// « % » mal formé, sur lequel decodeURIComponent lèverait « URI malformed » et
// ferait échouer toute la recherche. On retombe alors sur la forme brute.
function decoderSlug(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}
function decode(s) {
  return (s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
    .replace(/&ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô').replace(/&icirc;/g, 'î')
    .replace(/&ccedil;/g, 'ç').replace(/&euml;/g, 'ë').replace(/&iuml;/g, 'ï')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
}

// Honorifique tiré du slug d'URL d'une fiche saint -> { sexe, type } ou null
// (pluriels, intitulés non nominaux : on ignore).
function lireHonorifique(slug) {
  const premier = sansAccents(slug.split('-')[0] || '').toLowerCase();
  switch (premier) {
    case 'saint': return { sexe: 'M', type: 'saint' };
    case 'sainte': return { sexe: 'F', type: 'saint' };
    case 'bienheureux': case 'bx': return { sexe: 'M', type: 'bienheureux' };
    case 'bienheureuse': case 'bse': return { sexe: 'F', type: 'bienheureux' };
    case 'venerable': case 'serviteur': case 'servante': return { sexe: premier === 'servante' ? 'F' : 'M', type: 'venerable' };
    default: return null; // « Saints », « Notre-Dame », etc.
  }
}

// Déduit la catégorie de préséance du libellé descriptif. Le martyre prime sur
// la dignité (un évêque martyr va chez les martyrs).
export function deduireCategorie(libelle) {
  const t = sansAccents(libelle || '').toLowerCase();
  if (/\bmartyr/.test(t)) return 'martyrs';
  if (/\bpatriarche|\bprophete/.test(t)) return 'patriarches_prophetes';
  if (/\bapotre|\bevangeliste/.test(t)) return 'apotres';
  if (/\bange|\barchange/.test(t)) return 'anges';
  if (/\bpape|\beveque|\barcheveque|\bdocteur de l/.test(t)) return 'eveques_docteurs';
  if (/\bpretre|\bcure|\bdiacre|\babbe|\babbesse|\bmoine|\bmoniale|\breligieu|\bfondat|\bermite|\bfrere|\bsoeur|\bjesuite|\bfranciscain|\bcarme|\bdominicain|\bbenedictin/.test(t)) return 'pretres_religieux';
  return 'laics'; // vierge/veuve/roi/reine/laïc/enfant…
}

// Année de décès depuis « (+ 430) », « († v. 430) », « + 430 ».
export function extraireAnneeDeces(libelle) {
  const m = decode(libelle).match(/[+†]\s*(?:v\.?\s*|vers\s*)?(\d{1,4})/i);
  return m ? parseInt(m[1], 10) : null;
}

// Parse une fiche prénom -> liste de candidats.
export function parserFichePrenom(html) {
  const candidats = [];
  const reAnchor = /<a\b[^>]*href="([^"]*\/contenus\/saint\/\d+\/([^"./]+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = reAnchor.exec(html)) !== null) {
    const url = m[1].startsWith('http') ? m[1] : BASE + m[1];
    const slug = decoderSlug(m[2]);
    const inner = m[3];
    const h5 = inner.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
    const p = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!h5) continue; // on ne garde que les entrées de liste structurées
    const honor = lireHonorifique(slug);
    if (!honor) continue;
    const nomCourt = decode(h5[1].replace(/<[^>]+>/g, ''));
    const descriptif = p ? decode(p[1].replace(/<[^>]+>/g, '')) : '';
    candidats.push({
      nom: `${honor.type === 'bienheureux' ? (honor.sexe === 'F' ? 'Bienheureuse' : 'Bienheureux') : (honor.sexe === 'F' ? 'Sainte' : 'Saint')} ${nomCourt}`,
      nomCourt,
      libelle: descriptif,
      url,
      sexe: honor.sexe,
      type: honor.type,
      categorie: deduireCategorie(descriptif),
      anneeDeces: extraireAnneeDeces(descriptif),
    });
  }
  return candidats;
}

// Trouve l'URL de la fiche prénom dont le slug correspond exactement au prénom.
// Couvre les deux formes renvoyées par nominis :
//   - liste de résultats : <a href="/contenus/prenom/<id>/<Slug>.html">
//   - match unique       : <script>window.location='/contenus/prenom/<id>/<Slug>.html'</script>
export function trouverUrlPrenom(html, prenom) {
  const cible = normaliser(prenom);
  const re = /\/contenus\/prenom\/\d+\/([^"'./]+)\.html/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (normaliser(decoderSlug(m[1])) === cible) {
      return BASE + m[0];
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rechercher(prenom, fetcher) {
  const body = new URLSearchParams({ rechercheType: 'prenom', rechercheValeur: prenom });
  return fetcher(`${BASE}/`, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
}

// nominis throttle les requêtes rapprochées (renvoie alors une page sans
// résultats) : on réessaie quelques fois avec un délai croissant.
async function chercherUrlFiche(prenom, fetcher, essais = 3) {
  for (let i = 0; i < essais; i++) {
    const html = await rechercher(prenom, fetcher);
    const url = trouverUrlPrenom(html, prenom);
    if (url) return url;
    if (i < essais - 1) await sleep(400 * (i + 1));
  }
  return null;
}

async function recuperer(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${url}`);
  return r.text();
}

// Résout un prénom : renvoie { prenom, urlFiche, principal, candidats } ou null.
// `principal` = le candidat dont le nom court correspond au prénom (sinon le
// premier candidat « saint » daté).
export async function resoudrePrenom(prenom, { fetcher = recuperer } = {}) {
  const urlFiche = await chercherUrlFiche(prenom, fetcher);
  if (!urlFiche) return null;

  const htmlFiche = await fetcher(urlFiche);
  const candidats = parserFichePrenom(htmlFiche);
  if (candidats.length === 0) return null;

  const cible = normaliser(prenom);
  const principal =
    candidats.find((c) => normaliser(c.nomCourt) === cible && c.type === 'saint') ||
    candidats.find((c) => c.type === 'saint' && c.anneeDeces !== null) ||
    candidats.find((c) => c.type === 'saint') ||
    candidats[0];

  return { prenom, urlFiche, principal, candidats };
}

// ——— CLI d'enrichissement (hors-ligne) ———
// Usage : node outils/enrichir-nominis.js <prénom>
// Affiche les candidats nominis sous forme de lignes prêtes à coller dans la
// table de outils/build-catalogue.mjs (À RELIRE : nominis range parfois le saint
// célèbre dans une fête conjointe, et la catégorie/le sexe sont déduits).
if (import.meta.url === `file://${process.argv[1]}`) {
  const prenom = process.argv.slice(2).join(' ').trim();
  if (!prenom) {
    console.error('Usage : node outils/enrichir-nominis.js <prénom>');
    process.exit(1);
  }
  const r = await resoudrePrenom(prenom);
  if (!r) {
    console.error(`Aucun résultat nominis pour « ${prenom} ».`);
    process.exit(2);
  }
  console.error(`# ${r.candidats.length} candidat(s) pour « ${prenom} » — ${r.urlFiche}`);
  const idDe = (nom) => sansAccents(nom).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  for (const c of r.candidats) {
    const an = c.anneeDeces ?? 'null';
    console.log(`  ['${idDe(c.nomCourt)}', '${c.categorie}', '${c.sexe}', ${an}, '${c.type}', null, null, ${JSON.stringify(c.libelle)}, ${JSON.stringify(c.nom)}, [${JSON.stringify(normaliser(prenom))}]],`);
  }
}
