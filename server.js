// Serveur du site + API d'enrichissement.
//   GET  /api/data            -> catalogue de référence fusionné avec l'extension locale
//   GET  /api/nominis?prenom= -> candidats saints/bienheureux trouvés sur nominis
//   POST /api/saints          -> enregistre un saint choisi dans catalogue-local
// Le reste est servi en statique (public/, src/, data/).
//
// nominis n'est appelé QUE pour l'enrichissement, à la demande de l'utilisateur
// (jamais pour composer la litanie elle-même).
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { resoudrePrenom } from './outils/enrichir-nominis.js';
import { saintDepuisCandidat, fusionnerCatalogue, trouverEquivalent } from './src/enrichissement.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const CATALOGUE = join(__dirname, 'data', 'catalogue.json');
const LOCAL = join(__dirname, 'data', 'catalogue-local.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const lireJson = async (chemin, defaut) => {
  try { return JSON.parse(await readFile(chemin, 'utf-8')); } catch { return defaut; }
};
const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};
const lireCorps = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  req.on('error', reject);
});

async function servirStatique(res, pathname) {
  const propre = pathname.replace(/\.\./g, '');
  const chemin = (propre.startsWith('/src/') || propre.startsWith('/data/'))
    ? join(__dirname, propre)
    : join(__dirname, 'public', propre === '/' ? 'index.html' : propre);
  try {
    const data = await readFile(chemin);
    res.writeHead(200, { 'Content-Type': MIME[extname(chemin)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Catalogue fusionné (référence + local)
  if (url.pathname === '/api/data') {
    const reference = await lireJson(CATALOGUE, { saints: {}, bases: {} });
    const local = await lireJson(LOCAL, { saints: {} });
    return json(res, 200, fusionnerCatalogue(reference, local));
  }

  // Recherche nominis (saints et bienheureux uniquement)
  if (url.pathname === '/api/nominis') {
    const prenom = (url.searchParams.get('prenom') || '').trim();
    if (!prenom) return json(res, 400, { erreur: 'prénom manquant' });
    try {
      const r = await resoudrePrenom(prenom);
      if (!r) return json(res, 404, { erreur: `Aucun saint trouvé sur nominis pour « ${prenom} »` });
      const candidats = r.candidats.filter((c) => c.type === 'saint' || c.type === 'bienheureux');
      return json(res, 200, { prenom, urlFiche: r.urlFiche, candidats });
    } catch (e) {
      // Détail technique en log serveur ; message clair (non technique) côté page.
      console.error(`nominis (« ${prenom} ») :`, e);
      return json(res, 502, { erreur: 'Nominis est momentanément indisponible. Réessayez dans quelques instants.' });
    }
  }

  // Enregistrement d'un saint choisi
  if (url.pathname === '/api/saints' && req.method === 'POST') {
    let corps;
    try { corps = await lireCorps(req); } catch { return json(res, 400, { erreur: 'corps JSON invalide' }); }
    const { candidat, prenom } = corps;
    if (!candidat || !candidat.nom || !candidat.categorie) return json(res, 400, { erreur: 'candidat incomplet' });

    const { id, saint } = saintDepuisCandidat(candidat, prenom || '');
    const reference = await lireJson(CATALOGUE, { saints: {} });
    const local = await lireJson(LOCAL, { saints: {} });

    // Collision d'identifiant : le saint existe déjà tel quel.
    if (reference.saints[id]) return json(res, 200, { id, saint: reference.saints[id], deja: true, source: 'reference' });
    if (local.saints[id]) return json(res, 200, { id, saint: local.saints[id], deja: true, source: 'local' });

    // Équivalence : le même saint sous un autre id (même catégorie/année/nom).
    // On renvoie l'existant plutôt que de créer un doublon (ex. « Saint Laurent »
    // vs « Saint Laurent de Rome », †258).
    const idRef = trouverEquivalent(reference.saints, saint);
    if (idRef) return json(res, 200, { id: idRef, saint: reference.saints[idRef], deja: true, equivalent: true, source: 'reference' });
    const idLoc = trouverEquivalent(local.saints, saint);
    if (idLoc) return json(res, 200, { id: idLoc, saint: local.saints[idLoc], deja: true, equivalent: true, source: 'local' });

    local.saints[id] = saint;
    await writeFile(LOCAL, JSON.stringify(local, null, 2) + '\n', 'utf-8');
    return json(res, 201, { id, saint, deja: false });
  }

  // Correction d'un saint déjà enregistré localement
  if (url.pathname === '/api/saints' && req.method === 'PUT') {
    let corps;
    try { corps = await lireCorps(req); } catch { return json(res, 400, { erreur: 'corps JSON invalide' }); }
    const { id } = corps;
    const local = await lireJson(LOCAL, { saints: {} });
    if (!id || !local.saints[id]) return json(res, 404, { erreur: 'saint local introuvable (le catalogue de référence n’est pas modifiable)' });
    const s = local.saints[id];
    if (corps.categorie) s.categorie = corps.categorie;
    if (corps.sexe) s.sexe = corps.sexe;
    if (corps.type) s.type = corps.type === 'bienheureux' ? 'bienheureux' : 'saint';
    if ('annusNatalis' in corps) s.annusNatalis = Number.isFinite(corps.annusNatalis) ? corps.annusNatalis : null;
    await writeFile(LOCAL, JSON.stringify(local, null, 2) + '\n', 'utf-8');
    return json(res, 200, { id, saint: s });
  }

  // Suppression d'un saint enregistré localement
  if (url.pathname === '/api/saints' && req.method === 'DELETE') {
    let corps;
    try { corps = await lireCorps(req); } catch { return json(res, 400, { erreur: 'corps JSON invalide' }); }
    const id = corps.id || url.searchParams.get('id');
    const local = await lireJson(LOCAL, { saints: {} });
    if (!id || !local.saints[id]) return json(res, 404, { erreur: 'saint local introuvable (le catalogue de référence n’est pas modifiable)' });
    delete local.saints[id];
    await writeFile(LOCAL, JSON.stringify(local, null, 2) + '\n', 'utf-8');
    return json(res, 200, { id, supprime: true });
  }

  return servirStatique(res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Litanie des saints → http://localhost:${PORT}`);
});
