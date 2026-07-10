# Litanie des saints — préparation d'un baptême

Petit site qui part d'une **litanie de départ** (au choix) et permet d'y **insérer des saints patrons** (prénoms du baptisé, des parents, parrain, marraine…) **au bon rang de préséance**, sans doublon. En cas d'homonymes (Jean, Thomas, Élisabeth…), l'utilisateur **choisit** le saint visé.

Trois litanies de départ sont proposées :
- **Baptême des petits enfants** (défaut) : Marie, Jean-Baptiste, Joseph, Pierre & Paul, puis « Tous les saints et saintes de Dieu ».
- **Vigile pascale** : la liste abrégée du Missel romain (avant la bénédiction de l'eau baptismale).
- **Litanie complète** : la litanie traditionnelle développée.

## Lancer le site

```bash
npm start          # http://localhost:3000 (serveur Node sans dépendance externe)
```

Ouvrez la page, choisissez une litanie de départ, tapez un prénom, choisissez le saint dans la liste (ou cherchez-le sur nominis s'il est absent), il s'insère. Boutons **Copier** / **Imprimer** pour le texte final. La composition (litanie de départ + saints ajoutés) est **conservée dans le navigateur** : vous la retrouvez au rechargement.

```bash
npm test           # tests du moteur de préséance et de la recherche
```

## Les règles de préséance (le cœur du projet)

Ordre fixé par l'*Ordo cantus Missae* (1972), repris dans le Rituel romain. Deux niveaux :

1. **La catégorie**, dans cet ordre :
   `Marie → anges → patriarches/prophètes → apôtres → martyrs → évêques & docteurs → prêtres & religieux → laïcs`
   (Joseph clôt toujours les prophètes ; Pierre & Paul ouvrent toujours les apôtres.)
2. **À l'intérieur d'une catégorie** : les **hommes d'abord** (ordre chronologique de **décès**, le *dies natalis*), **puis les femmes** (même ordre). À catégorie et sexe égaux, un **saint précède un bienheureux**.

> Le critère de départage est la **date de mort**, ni la naissance ni la canonisation.
> Exception non automatisée : un fondateur peut précéder son disciple (Ignace de Loyola †1556 avant François Xavier †1552) ; elle est encodée « en dur » dans l'ordre de la litanie de base.

Détails : ce ne sont pas des « papes » qui forment une catégorie — un pape se range selon ce qu'il fut (Corneille chez les martyrs, Léon chez les évêques-docteurs). Et les anges viennent **avant** Jean-Baptiste et Joseph.

Sources : *The Litany of Saints in the Liturgy* (Adoremus Bulletin) ; *Structure of the Litany of Saints* (diocèse d'Érié) ; *Litanies des saints* (diocèse de Paris).

## Architecture

```
data/catalogue.json        Catalogue curé (généré ; ne pas éditer à la main)
data/catalogue-local.json  Saints ajoutés via le web (écrit par le serveur)
src/precedence.js          Règles de préséance (catégories + tri par dies natalis)
src/litanie.js             Insertion d'un patron + déduplication (moteur)
src/catalogue.js           Résolution des litanies de départ + recherche par prénom
src/enrichissement.js      Candidat nominis -> entrée de catalogue ; fusion curé+local
src/rendu.js               Mise en forme du texte (« …, priez pour nous »)
public/                    Le site (index.html, app.js, style.css)
server.js                  Serveur + API (/api/data, /api/nominis, /api/saints)
outils/build-catalogue.mjs Construit data/catalogue.json à partir d'une table compacte
outils/enrichir-nominis.js Recherche nominis (réutilisée par le serveur et en CLI)
test/                      Tests (node --test)
```

Principe clé : **les champs de préséance (`categorie`, `sexe`, `anneeDeces`, `type`) sont indépendants de la langue.** Seul l'affichage (`nom`, `qualite`) est traduisible (`i18n`). Le site est donc prêt pour le multilingue (v1 : français seul).

Autre principe : la **litanie de base n'est jamais re-triée** — elle reste le texte du rituel. On ne fait qu'**insérer** les patrons choisis au bon rang : à l'intérieur d'une catégorie déjà présente (par date de mort), ou, si la catégorie est absente de la litanie courte, à sa place selon le rang des catégories. Joseph reste épinglé en fin des prophètes (`epingleFin`) et « Saint Pierre et saint Paul » couvre les deux apôtres pour la déduplication (`couvre`).

**Regrouper certains saints** (case optionnelle, décochée par défaut) : l'usage
de l'Église associe traditionnellement certains saints en une seule invocation
(Côme et Damien, Perpétue et Félicité, Corneille et Cyprien…). Quand la case est
cochée et que **tous** les membres d'un groupe sont présents dans la litanie —
qu'ils viennent de la base de départ ou d'un ajout — leurs invocations
individuelles sont remplacées par l'invocation jointe, placée au rang du membre le
mieux placé. Les groupes sont déclarés dans `data/catalogue.json` (champ
`groupes` : `{ cle, membres, i18n }`), et le regroupement réutilise le même champ
`couvre` que les paires figées de la base.

## Enrichir le catalogue

### Depuis la page web (recommandé)

Quand un prénom n'est pas dans le catalogue, tapez-le puis cliquez **« Chercher
« … » sur nominis »**. Le site interroge nominis.cef.fr, affiche les **saints et
bienheureux** correspondants (avec qualité, année et marqueur *bienheureux·se*) ;
vous choisissez le bon. Le saint est alors :
- **inséré** dans la litanie à son rang de préséance ;
- **enregistré** dans `data/catalogue-local.json` — donc trouvé directement la
  prochaine fois, et pris en compte pour la déduplication.

Avant l'enregistrement, un **formulaire pré-rempli** (catégorie, type, sexe,
année) vous laisse **confirmer ou corriger** la proposition — nominis ne dit pas
toujours tout (ex. saint Maurice, martyr, n'a pas « martyr » dans son titre).

**Corriger ou supprimer après coup** : chaque saint ajouté via le web porte un
crayon **✎** (sur sa pastille dans « Ajoutés », et dans la liste de recherche).
Il rouvre le formulaire ; le bouton **« Supprimer de la base »** l'enlève du
catalogue local. Le catalogue curé (`catalogue.json`), lui, n'est jamais modifié.

nominis n'est appelé que pour cet enrichissement, à votre demande — jamais pour
composer la litanie.

### En lot (catalogue curé)

Pour étoffer le catalogue de référence : éditez la table de
`outils/build-catalogue.mjs`, régénérez avec `node outils/build-catalogue.mjs`,
puis `npm test`. L'assistant CLI propose des lignes prêtes à coller (à relire) :

```bash
node outils/enrichir-nominis.js "Maximilien"
#   ['maximilien-kolbe', 'martyrs', 'M', 1941, 'saint', null, null, "Frère mineur, martyr…", "Saint Maximilien Kolbe", ["maximilien"]],
```

À terme, l'OCR du *Martyrologium Romanum* pourra alimenter le catalogue de la
même façon (hors-ligne, avec relecture).

## Pistes (phase 2)

- **Multilingue** : remplir `i18n.en`, `i18n.la` ; sélecteur de langue.
- **Martyrologe romain** (référence d'autorité, organisé par *dies natalis*) : pipeline OCR → données, avec relecture. Réserve de droits sur l'édition 2004 (extraire les faits, ne pas republier le texte).
- **Saints locaux** : exploiter le champ `region` pour mettre en avant les patrons d'un diocèse / pays.
