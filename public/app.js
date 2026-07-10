import { construireLitanie } from '/src/litanie.js';
import { entreesBase, listerBases, chercherCandidats, descriptionCandidat, infoSaint } from '/src/catalogue.js';
import { enBlocs, enTexte } from '/src/rendu.js';
import { CATEGORIES, LIBELLES_CATEGORIES } from '/src/precedence.js';

const $ = (s) => document.querySelector(s);
const LANGUE = 'fr';

let catalogue = null;
let cleBase = null;
let base = [];
let requeteCourante = '';
const choisis = []; // saints ajoutés par l'utilisateur, dans l'ordre d'ajout

const CLE_ETAT = 'litanie-etat-v1';

function sauvegarderEtat() {
  try {
    localStorage.setItem(CLE_ETAT, JSON.stringify({
      cleBase,
      ids: choisis.map((c) => c.saintId).filter(Boolean),
      bxFin: $('#bxFin').checked,
      grouper: $('#grouper').checked,
      titres: $('#titres').checked,
    }));
  } catch { /* localStorage indisponible : on continue sans persistance */ }
}
function restaurerEtat() {
  try { return JSON.parse(localStorage.getItem(CLE_ETAT) || 'null'); } catch { return null; }
}

async function init() {
  catalogue = await (await fetch('/api/data')).json();
  const etat = restaurerEtat();
  cleBase = (etat && catalogue.bases[etat.cleBase]) ? etat.cleBase : catalogue.baseParDefaut;

  const select = $('#modele');
  for (const { cle, nom } of listerBases(catalogue)) {
    const opt = document.createElement('option');
    opt.value = cle;
    opt.textContent = nom;
    select.appendChild(opt);
  }
  select.value = cleBase;
  select.addEventListener('change', () => {
    cleBase = select.value;
    base = entreesBase(catalogue, cleBase, LANGUE);
    recomposer();
  });

  // Restaure les options d'affichage et les saints ajoutés (encore au catalogue).
  if (etat) {
    $('#bxFin').checked = !!etat.bxFin;
    $('#grouper').checked = !!etat.grouper;
    $('#titres').checked = !!etat.titres;
    if (Array.isArray(etat.ids)) {
      for (const id of etat.ids) {
        if (catalogue.saints[id]) choisis.push(infoSaint(catalogue, id, LANGUE));
      }
    }
  }
  $('#titres').disabled = $('#bxFin').checked;
  base = entreesBase(catalogue, cleBase, LANGUE);
  recomposer();
}

// ——— Recherche locale + désambiguïsation ———

function afficherCandidats(requete) {
  requeteCourante = requete;
  const ul = $('#candidats');
  ul.innerHTML = '';
  const q = requete.trim();
  if (!q) { ul.hidden = true; return; }

  for (const c of chercherCandidats(catalogue, q, LANGUE)) {
    ul.appendChild(itemCandidat(c));
  }
  // Action : étendre la recherche à nominis (à la demande, pour les saints absents).
  const action = document.createElement('li');
  action.className = 'action-nominis';
  action.tabIndex = 0;
  action.innerHTML = `🔎 Chercher « <strong>${q}</strong> » sur nominis…`;
  const lancer = () => chercherSurNominis(q);
  action.addEventListener('click', lancer);
  action.addEventListener('keydown', (e) => { if (e.key === 'Enter') lancer(); });
  ul.appendChild(action);
  ul.hidden = false;
}

function itemCandidat(c) {
  const li = document.createElement('li');
  li.tabIndex = 0;
  const dejaLa = estPresent(c.saintId);
  li.className = 'candidat' + (dejaLa ? ' deja' : '');
  const bx = c.type === 'bienheureux' ? '<span class="bx">bienheureux·se</span>' : '';
  const corrigeable = c.source === 'nominis'; // saint ajouté via le web -> modifiable
  li.innerHTML = `<span class="nom">${c.invocation}</span> <span class="desc">${descriptionCandidat(c)}</span> ${bx}` +
    (dejaLa ? '<span class="tag">déjà présent</span>' : '') +
    (corrigeable ? '<button class="corriger" title="Corriger ce saint">✎</button>' : '');
  if (!dejaLa) {
    const add = () => choisir(c);
    li.addEventListener('click', add);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  }
  if (corrigeable) {
    li.querySelector('.corriger').addEventListener('click', (e) => { e.stopPropagation(); ouvrirCorrection(c); });
  }
  return li;
}

// ——— Enrichissement via nominis ———

async function chercherSurNominis(prenom) {
  const ul = $('#candidats');
  ul.innerHTML = `<li class="info-nominis">Recherche de « ${prenom} » sur nominis…</li>`;
  ul.hidden = false;
  let data;
  try {
    const r = await fetch(`/api/nominis?prenom=${encodeURIComponent(prenom)}`);
    data = await r.json();
    if (!r.ok) throw new Error(data.erreur || 'erreur');
  } catch (e) {
    ul.innerHTML = `<li class="info-nominis erreur">${e.message}</li>`;
    return;
  }
  ul.innerHTML = '';
  const entete = document.createElement('li');
  entete.className = 'info-nominis';
  entete.innerHTML = `Résultats nominis pour « ${prenom} » — cliquez pour ajouter`;
  ul.appendChild(entete);
  for (const cand of data.candidats) {
    ul.appendChild(itemNominis(cand, prenom));
  }
  if (data.candidats.length === 0) {
    ul.appendChild(Object.assign(document.createElement('li'), { className: 'info-nominis', textContent: 'Aucun saint ni bienheureux exploitable.' }));
  }
}

function itemNominis(cand, prenom) {
  const li = document.createElement('li');
  li.tabIndex = 0;
  li.className = 'candidat nominis';
  const bx = cand.type === 'bienheureux' ? '<span class="bx">bienheureux·se</span>' : '';
  li.innerHTML = `<span class="nom">${cand.nom}</span> <span class="desc">${cand.libelle || ''}</span> ${bx}`;
  const ouvrir = () => editerPuisAjouter(cand, prenom);
  li.addEventListener('click', ouvrir);
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter') ouvrir(); });
  return li;
}

// ——— Formulaire de relecture / correction ———
// nominis ne dit pas toujours tout (ex. saint Maurice, martyr, n'a pas « martyr »
// dans son titre) : la catégorie/le type/le sexe/l'année proposés sont donc
// confirmés ou corrigés ici avant enregistrement.

function optionsCategories(selected) {
  return CATEGORIES.map((c) => `<option value="${c}"${c === selected ? ' selected' : ''}>${LIBELLES_CATEGORIES[c] || c}</option>`).join('');
}

function ouvrirFormulaire({ nom, prefill, labelOk, onConfirm, onDelete }) {
  const ul = $('#candidats');
  ul.innerHTML = '';
  ul.hidden = false;
  const li = document.createElement('li');
  li.className = 'edition';
  li.innerHTML = `
    <div class="ed-nom">${nom}</div>
    <label>Catégorie <select name="categorie">${optionsCategories(prefill.categorie)}</select></label>
    <label>Type <select name="type">
      <option value="saint"${prefill.type !== 'bienheureux' ? ' selected' : ''}>saint(e)</option>
      <option value="bienheureux"${prefill.type === 'bienheureux' ? ' selected' : ''}>bienheureux(se)</option>
    </select></label>
    <label>Sexe <select name="sexe">
      <option value="M"${prefill.sexe !== 'F' ? ' selected' : ''}>masculin</option>
      <option value="F"${prefill.sexe === 'F' ? ' selected' : ''}>féminin</option>
    </select></label>
    <label>Décès (année) <input type="number" name="anneeDeces" value="${prefill.anneeDeces ?? ''}" placeholder="ex. 287" /></label>
    <div class="ed-boutons">
      <button type="button" class="ed-ok">${labelOk}</button>
      <button type="button" class="ed-annuler">Annuler</button>
      ${onDelete ? '<button type="button" class="ed-suppr">Supprimer de la base</button>' : ''}
    </div>`;
  ul.appendChild(li);
  const champ = (n) => li.querySelector(`[name="${n}"]`).value;
  li.querySelector('.ed-ok').addEventListener('click', () => {
    const an = parseInt(champ('anneeDeces'), 10);
    onConfirm({ categorie: champ('categorie'), type: champ('type'), sexe: champ('sexe'), anneeDeces: Number.isFinite(an) ? an : null });
  });
  li.querySelector('.ed-annuler').addEventListener('click', () => afficherCandidats(requeteCourante));
  if (onDelete) li.querySelector('.ed-suppr').addEventListener('click', onDelete);
  li.querySelector('select').focus();
}

// Ajout depuis nominis : on relit la proposition puis on enregistre.
function editerPuisAjouter(cand, prenom) {
  ouvrirFormulaire({
    nom: cand.nom,
    labelOk: 'Ajouter',
    prefill: { categorie: cand.categorie, type: cand.type, sexe: cand.sexe, anneeDeces: cand.anneeDeces },
    onConfirm: async (corr) => {
      let saved;
      try {
        const r = await fetch('/api/saints', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidat: { ...cand, ...corr }, prenom }),
        });
        saved = await r.json();
        if (!r.ok) throw new Error(saved.erreur || 'échec enregistrement');
      } catch (e) {
        $('#candidats').innerHTML = `<li class="info-nominis erreur">${e.message}</li>`;
        return;
      }
      catalogue.saints[saved.id] = saved.saint;
      const info = infoSaint(catalogue, saved.id, LANGUE);
      if (estPresent(saved.id)) { fermerRecherche(); recomposer(); return; }
      choisir(info);
    },
  });
}

// Correction (et suppression) d'un saint enregistré localement.
function ouvrirCorrection(c) {
  ouvrirFormulaire({
    nom: c.invocation,
    labelOk: 'Enregistrer',
    prefill: { categorie: c.categorie, type: c.type, sexe: c.sexe, anneeDeces: c.anneeDeces },
    onConfirm: async (corr) => {
      let saved;
      try {
        const r = await fetch('/api/saints', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: c.saintId, ...corr }),
        });
        saved = await r.json();
        if (!r.ok) throw new Error(saved.erreur || 'échec');
      } catch (e) {
        $('#candidats').innerHTML = `<li class="info-nominis erreur">${e.message}</li>`;
        return;
      }
      catalogue.saints[c.saintId] = saved.saint;
      const i = choisis.findIndex((x) => x.saintId === c.saintId);
      if (i >= 0) choisis[i] = infoSaint(catalogue, c.saintId, LANGUE); // re-place si déjà dans la litanie
      fermerRecherche();
      recomposer();
    },
    onDelete: async () => {
      if (!confirm(`Supprimer définitivement « ${c.invocation} » du catalogue ?`)) return;
      try {
        const r = await fetch('/api/saints', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: c.saintId }),
        });
        if (!r.ok) throw new Error((await r.json()).erreur || 'échec');
      } catch (e) {
        $('#candidats').innerHTML = `<li class="info-nominis erreur">${e.message}</li>`;
        return;
      }
      delete catalogue.saints[c.saintId];
      const i = choisis.findIndex((x) => x.saintId === c.saintId);
      if (i >= 0) choisis.splice(i, 1); // retirer aussi de la litanie courante
      fermerRecherche();
      recomposer();
    },
  });
}

// ——— Sélection / composition ———

function estPresent(saintId) {
  if (!saintId) return false;
  if (choisis.some((c) => c.saintId === saintId)) return true;
  return base.some((e) => e.saintId === saintId || (e.couvre && e.couvre.includes(saintId)));
}

function choisir(saint) {
  if (estPresent(saint.saintId)) return;
  choisis.push(saint);
  fermerRecherche();
  recomposer();
  $('#recherche').focus();
}

function fermerRecherche() {
  $('#recherche').value = '';
  requeteCourante = '';
  $('#candidats').hidden = true;
}

function retirer(saintId) {
  const i = choisis.findIndex((c) => c.saintId === saintId);
  if (i >= 0) choisis.splice(i, 1);
  recomposer();
}

// Options d'ordre et d'affichage tirées des cases à cocher.
function options() {
  return { bienheureuxALaFin: $('#bxFin').checked, grouper: $('#grouper').checked, groupes: catalogue.groupes || [], langue: LANGUE };
}
// Cocher « bienheureux à la fin » supprime les intertitres (à la demande).
function titresVisibles() {
  return $('#titres').checked && !$('#bxFin').checked;
}

function recomposer() {
  const opts = options();
  const { entrees } = construireLitanie(base, choisis, opts);
  afficherLitanie(entrees, opts);
  afficherPuces();
  window._texte = enTexte(entrees, { titres: titresVisibles(), bienheureuxALaFin: opts.bienheureuxALaFin });
  sauvegarderEtat();
}

function afficherPuces() {
  const box = $('#ajoutes');
  box.innerHTML = '';
  if (choisis.length === 0) return;
  const label = document.createElement('span');
  label.className = 'puces-label';
  label.textContent = 'Ajoutés :';
  box.appendChild(label);
  for (const c of choisis) {
    const puce = document.createElement('span');
    puce.className = 'puce';
    const corrigeable = c.source === 'nominis'; // les saints ajoutés via le web sont modifiables
    puce.innerHTML = `${c.invocation} ` +
      (corrigeable ? `<button class="p-corriger" title="Corriger / supprimer">✎</button>` : '') +
      `<button class="p-retirer" title="Retirer de la litanie" aria-label="Retirer ${c.invocation}">×</button>`;
    if (corrigeable) puce.querySelector('.p-corriger').addEventListener('click', () => ouvrirCorrection(c));
    puce.querySelector('.p-retirer').addEventListener('click', () => retirer(c.saintId));
    box.appendChild(puce);
  }
}

function afficherLitanie(entrees, opts) {
  const cont = $('#litanie');
  cont.innerHTML = '';
  const titres = titresVisibles();
  for (const b of enBlocs(entrees, opts)) {
    if (b.type === 'titre') {
      if (!titres) continue;
      const h = document.createElement('h3');
      h.textContent = b.texte;
      cont.appendChild(h);
    } else {
      const p = document.createElement('p');
      p.className = 'invocation' + (b.insere ? ' inseree' : '') + (b.conclusion ? ' conclusion' : '');
      p.textContent = b.texte;
      cont.appendChild(p);
    }
  }
}

// ——— Événements ———

$('#recherche').addEventListener('input', (e) => afficherCandidats(e.target.value));
$('#recherche').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fermerRecherche();
  if (e.key === 'Enter') {
    const premier = $('#candidats .candidat:not(.deja)');
    if (premier) premier.click();
  }
});
document.addEventListener('click', (e) => {
  // On utilise composedPath() (chemin figé au moment du clic) plutôt que
  // e.target.closest : le gestionnaire d'un candidat remplace le contenu du
  // menu, ce qui détache la cible et fausserait closest().
  if (!e.composedPath().some((n) => n.id === 'ajout')) $('#candidats').hidden = true;
});
$('#titres').addEventListener('change', recomposer);
$('#grouper').addEventListener('change', recomposer);
$('#bxFin').addEventListener('change', () => {
  $('#titres').disabled = $('#bxFin').checked; // « à la fin » force l'absence d'intertitres
  recomposer();
});
$('#copier').addEventListener('click', async () => {
  await navigator.clipboard.writeText(window._texte || '');
  $('#copier').textContent = 'Copié ✓';
  setTimeout(() => ($('#copier').textContent = 'Copier'), 1500);
});
$('#imprimer').addEventListener('click', () => window.print());

init();
