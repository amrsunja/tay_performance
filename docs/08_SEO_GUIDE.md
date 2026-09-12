# SEO Tay Performance — ce qui est fait, ce qu'il reste à faire

Dernière mise à jour : 12 septembre 2026
Périmètre : `tay_performance_web` (React 19 + Vite, hébergé chez Hostinger).

---

## 0. À FAIRE EN PREMIER (bloquant)

Trois points bloquent le référencement tant qu'ils ne sont pas traités.

### 0.1 — Trancher le nom de domaine

La fiche Google Business pointe vers **`tay-performance.fr`** (avec tiret).
Le code, le sitemap, les canonical et le JSON-LD utilisent **`tayperformance.fr`** (sans tiret).

Deux domaines qui servent le même site = Google divise la popularité entre les deux et
n'en indexe qu'un, au hasard. Il faut **un domaine canonique et un seul**.

Marche à suivre :

1. Décider lequel est le vrai (garder celui qui a déjà des liens et de l'historique).
2. Chez Hostinger, faire pointer l'autre domaine en **redirection 301** vers le canonique
   (Domaines → Redirections). Pas un parking, pas un frame : une 301.
3. Si le canonique n'est pas `tayperformance.fr`, changer la valeur dans **un seul endroit** :
   variable d'environnement `VITE_SITE_URL` au moment du build (Hostinger → Avancé →
   Variables d'environnement), puis rebuild. Le sitemap, les canonical et le pré-rendu la
   reprennent automatiquement. Le JSON-LD statique de `index.html` est en dur : à corriger
   à la main dans ce cas (chercher `tayperformance.fr`).
4. Corriger l'URL du site dans la fiche Google Business.

### 0.2 — Compléter les mentions légales

Ouvrir `tay_performance_web/src/lib/legal.ts`. Tous les champs marqués `TODO(...)`
s'affichent **en orange sur la page publique** tant qu'ils ne sont pas remplis. À compléter :

| Champ | Où le trouver |
|---|---|
| `legalForm` | Extrait Kbis / avis de situation INSEE (EI, SASU, SARL…) |
| `siret` | SIREN 987 811 411 + les 5 chiffres NIC de l'établissement — avis de situation INSEE |
| `vat` | N° TVA intracom, ou la mention « TVA non applicable, art. 293 B du CGI » |
| `registry` | RCS ou Répertoire des Métiers + ville (ex. « RCS Strasbourg ») |
| `ape` | Code APE / NAF (avis INSEE) |
| `email` | Une adresse de contact publique **réellement relevée** — obligation LCEN |
| `insurance` | Assureur RC pro + n° de contrat + couverture géographique |
| `MEDIATOR` | Médiateur de la consommation auquel vous avez adhéré (obligatoire, art. L612-1 C. conso) |

Sans médiateur désigné, l'entreprise s'expose à une amende administrative (jusqu'à 3 000 €
pour une personne physique). Coût d'adhésion type : 60 à 150 € / an.

### 0.3 — Vérifier les horaires

Les horaires du JSON-LD (`index.html`) sont **lun–jeu 9h–18h, ven 9h–19h, sam 9h–16h**.
Ceux affichés sur `/adresse` viennent de la base (Admin → Config → Horaires). Ceux de
Google Business viennent de Google. **Les trois doivent dire la même chose**, sinon Google
signale une incohérence et peut masquer le bloc horaires.

---

## 1. Ce qui a été fait dans le code

### Pages créées
- `/mentions-legales` — obligation LCEN art. 6-III
- `/confidentialite` — RGPD : données collectées, sous-traitants (Supabase, Resend, Twilio,
  Hostinger, Google Maps), durées de conservation, droits, CNIL
- `/cgv` — réservation, prix, annulation, rétractation, garantie de pose, seuil 70 % TLV

Toutes les valeurs société viennent de `src/lib/legal.ts` : on ne réécrit jamais un SIRET
en dur dans une page.

### Contenu et réassurance
- **Section avis** (`#avis`) — note 5,0 et 170 avis relevés sur la fiche Google, plus 3 avis
  verbatim. Source : `src/lib/reviews.ts`.
- **Section « Pourquoi Tay Performance »** (`#pourquoi`) — 6 arguments concrets + 6 engagements.
- **FAQ visible** (`#faq`) — 9 questions qui reprennent les vraies requêtes Google
  (légalité, prix, durée, pare-brise, retrait d'ancien film, séchage, contrôle technique,
  capteurs, adresse).
- Textes réécrits sur toute la landing : suppression du jargon (« zéro friction »,
  « garage digital », « L'obscurité posée au millimètre »).
- **Corrections factuelles** : le site annonçait « créneau confirmé en direct » alors que
  l'atelier valide ensuite la demande, et « 4,9 de note » alors que la vraie note est 5,0.
  Le « 3 000+ véhicules traités » a été retiré faute de source vérifiable — à remettre si
  le chiffre est réel.

### SEO technique
- **Pré-rendu des métadonnées** (`scripts/prerender.mjs`) : chaque route publique reçoit son
  propre `index.html` avec le bon `<title>`, `description`, `canonical` et Open Graph.
  Indispensable : Facebook, WhatsApp et LinkedIn n'exécutent pas JavaScript et affichaient
  jusqu'ici le titre de l'accueil pour **toutes** les pages partagées.
- **Sitemap généré** (`scripts/sitemap.mjs`) depuis `scripts/seo-routes.mjs`, lancé à chaque
  build : il ne peut plus se désynchroniser des routes réelles.
- **JSON-LD** : `AggregateRating` (5,0 / 170) + `Review`, `FAQPage` généré depuis le contenu
  affiché, `BreadcrumbList`, catalogue de prestations enrichi, coordonnées GPS corrigées
  (elles pointaient 700 m à côté).
- **`.htaccess`** : redirection 301 http → https et www → sans-www, suppression du slash
  final, service des pages pré-rendues, compression gzip, en-têtes de sécurité.
- `robots.txt` : routes privées bloquées, GPTBot et PerplexityBot explicitement autorisés.
- `site.webmanifest` ajouté.

### Performance (Core Web Vitals — critère de classement)
| | Avant | Après |
|---|---|---|
| Bundle JS principal | 788 Ko (221 Ko gzip) | 393 Ko (120 Ko gzip) |
| Vidéos d'ambiance de la hero | 11,1 Mo | 1,26 Mo |
| Vidéos réseaux sociaux | 47 Mo, préchargées | 17 Mo, `preload="none"` + image d'affiche |
| CSS principal | 98 Ko | 70 Ko |

Le panneau admin, le portail client et les pages légales sont maintenant chargés à la
demande (`React.lazy`) au lieu d'être téléchargés par un visiteur venu lire un prix.
Les vidéos originales sont conservées dans `src/assets/videos/` ; les versions servies sont
dans `src/assets/media/`.

---

## 2. À faire manuellement — par ordre d'impact

### Étape 1 — Google Business Profile (le plus gros levier, et de loin)

Pour une activité locale, **la fiche Google pèse plus lourd que le site**. Elle est déjà
excellente (5,0 / 170) : il faut l'exploiter.

- [ ] Corriger l'URL du site (voir 0.1) et ajouter un lien vers `/reserver` dans le champ
      « Rendez-vous ».
- [ ] Vérifier la **catégorie principale** : « Service de teinte de vitres automobiles » est
      la bonne. Ajouter en catégories secondaires : *Atelier de carrosserie*, *Service de
      nettoyage de voitures*, *Magasin d'accessoires automobiles*.
- [ ] Renseigner les **services** un par un (vitres teintées, retrait d'ancien film, covering,
      sellerie, detailing, polissage d'optiques, éclairage LED) avec une description pour chacun.
- [ ] Renseigner les **attributs** : parking sur place, salle d'attente, Wi-Fi, accessibilité,
      moyens de paiement, rendez-vous en ligne.
- [ ] Publier un **post Google** par semaine (photo avant/après + une phrase + bouton
      « Réserver »). Les posts sont un signal de fraîcheur et s'affichent dans le pack local.
- [ ] **Ajouter des photos toutes les semaines**, géolocalisées, nommées correctement avant
      l'upload (`vitres-teintees-bmw-serie-5-illkirch.jpg`, pas `IMG_4821.jpg`).
- [ ] **Répondre à chaque avis** dans les 48 h, en réutilisant naturellement les mots-clés :
      « Merci pour votre retour sur la pose de vos vitres teintées à Illkirch ». Google lit
      les réponses.
- [ ] Activer la messagerie et les questions/réponses. Poser vous-même les 5 questions les
      plus fréquentes et y répondre (c'est autorisé et recommandé).

**Rythme d'avis à viser : 4 à 8 nouveaux par mois.** C'est le facteur n° 1 du classement dans
le pack local. Concrètement : un QR code plastifié sur le comptoir + un SMS le lendemain de
la prestation. Ne jamais offrir de contrepartie contre un avis (interdit par Google et par
l'art. L121-2 du Code de la consommation).

### Étape 2 — Google Search Console (à faire le jour de la mise en ligne)

1. [ ] Créer la propriété sur https://search.google.com/search-console — choisir
       **« Domaine »** (validation par enregistrement DNS TXT chez Hostinger), pas « Préfixe
       d'URL » : la propriété Domaine couvre http, https, www et sous-domaines d'un coup.
2. [ ] Soumettre `https://tayperformance.fr/sitemap.xml`.
3. [ ] Utiliser **Inspection d'URL → Demander l'indexation** pour l'accueil, `/reserver`,
       `/adresse`. Les pages légales n'en valent pas la peine.
4. [ ] Vérifier dans **Résultats enrichis** que `FAQPage` et `LocalBusiness` sont détectés
       sans erreur.
5. [ ] Créer aussi un compte **Bing Webmaster Tools** — import en un clic depuis Search
       Console. Bing alimente ChatGPT et Copilot, qui envoient de plus en plus de trafic local.

**À surveiller ensuite, une fois par mois :** l'onglet *Performances*, filtré sur les
requêtes contenant « teint ». Les requêtes en position 5 à 15 sont celles où un ajout de
contenu rapporte le plus vite.

### Étape 3 — Outils de contrôle avant / après

- [ ] **PageSpeed Insights** (https://pagespeed.web.dev) sur l'accueil, onglet **Mobile**.
      Viser ≥ 80. Noter le score aujourd'hui pour pouvoir comparer.
- [ ] **Test des résultats enrichis** (https://search.google.com/test/rich-results) : doit
      afficher *Entreprise locale*, *FAQ* et *Fil d'Ariane* sans erreur.
- [ ] **Validateur de schéma** (https://validator.schema.org).
- [ ] Partager `https://tayperformance.fr/cgv` sur WhatsApp : le titre affiché doit être
      « Conditions générales… » et non celui de l'accueil. C'est le test que le pré-rendu
      fonctionne en production.

### Étape 4 — Citations locales (NAP)

Google recoupe **N**om, **A**dresse, **T**éléphone entre les annuaires. La moindre variation
(« 19 Rue de l'industrie » vs « 19 rue de l'Industrie ») affaiblit le signal.

Écrire la forme exacte une fois pour toutes et la copier-coller partout :

```
Tay Performance
19 Rue de l'Industrie
67400 Illkirch-Graffenstaden
06 05 50 50 28
```

À créer / corriger, dans cet ordre :

- [ ] Apple Plans (Apple Business Connect) — indispensable pour les iPhone
- [ ] Pages Jaunes
- [ ] Bing Places
- [ ] Waze
- [ ] Yelp France
- [ ] Facebook (compléter adresse + horaires + bouton « Réserver » vers `/reserver`)
- [ ] Instagram : mettre `tayperformance.fr` en lien de bio (pas un Linktree — le lien direct
      transmet la popularité)
- [ ] Annuaire de la CCI Alsace Eurométropole
- [ ] Vitrine de la ville d'Illkirch-Graffenstaden si elle existe

### Étape 5 — Contenu à écrire (le vrai travail de fond)

Le site couvre aujourd'hui une seule requête : « vitres teintées Strasbourg ». Chaque page
supplémentaire ouvre une nouvelle porte d'entrée. Par ordre de rentabilité :

1. [ ] **Une page par ville** — `/vitres-teintees-strasbourg`, `/vitres-teintees-schiltigheim`,
       `/vitres-teintees-illkirch`… **Attention** : une page par ville avec le même texte et
       juste le nom changé est du *doorway page*, sanctionné. Chaque page doit avoir un
       contenu propre : temps de trajet réel depuis cette ville, un chantier fait pour un
       client de là-bas, une photo différente, un avis de cette commune.
2. [ ] **Une page par prestation** — `/covering-strasbourg`, `/detailing-strasbourg`,
       `/polissage-phares-strasbourg`. Aujourd'hui elles sont noyées dans la landing et ne
       peuvent pas se positionner seules.
3. [ ] **Une page tarifs publique** — « Prix vitres teintées : combien ça coûte vraiment ».
       « prix vitres teintées » est la deuxième requête du secteur en volume. Elle peut
       renvoyer vers le configurateur.
4. [ ] **Un guide réglementation** — « Vitres teintées et loi française : ce qui est autorisé
       en 2026 ». Ce type de page attire des liens naturels depuis les forums auto.
5. [ ] **Des pages avant / après** — une par chantier marquant, avec la marque et le modèle
       dans le titre. « vitres teintées Golf 8 », « teinte BMW Série 3 » sont des requêtes
       réelles et peu concurrentielles.

Règle : **une page = une intention de recherche**. Pas deux pages sur le même sujet, elles se
cannibaliseraient.

### Étape 6 — Liens entrants

Pour une activité locale, cinq bons liens valent mieux que cinquante annuaires douteux.

- [ ] Partenaires : concessions, garages, loueurs, carrossiers, préparateurs, clubs auto
      alsaciens. Demander un lien depuis leur page « partenaires ».
- [ ] Presse locale : DNA, Pokaa, Rue89 Strasbourg. Un angle éditorial (« comment un garage
      d'Illkirch a mis son agenda en ligne ») passe mieux qu'une demande de lien nue.
- [ ] Clubs et forums auto de la région.
- [ ] Fournisseurs de films : beaucoup de marques tiennent une page « installateurs agréés ».
      Y figurer est un lien de qualité et un argument de vente.
- [ ] **Ne jamais acheter de packs de liens.** Le rapport risque/bénéfice est mauvais pour un
      site local.

### Étape 7 — Suivi mensuel (30 minutes)

| Indicateur | Où | Objectif |
|---|---|---|
| Impressions et clics | Search Console → Performances | en hausse |
| Position moyenne « vitres teintées strasbourg » | Search Console | top 3 |
| Nouveaux avis Google | Fiche GBP | +4 à 8 / mois |
| Appels et itinéraires depuis la fiche | GBP → Statistiques | en hausse |
| Score mobile | PageSpeed Insights | ≥ 80 |
| Erreurs d'indexation | Search Console → Pages | 0 |

---

## 3. Améliorations techniques restantes (optionnelles)

Par ordre de rapport gain / effort :

1. **Sortir Supabase du chargement initial** — le client Supabase (220 Ko) est chargé sur la
   page d'accueil alors qu'un visiteur venu de Google n'en a pas besoin avant de cliquer sur
   « Réserver ». Rendre `AuthProvider` paresseux ferait gagner ~60 Ko gzip sur le LCP mobile.
2. **Convertir les images en WebP ou AVIF** — les JPEG de la galerie pèsent encore ~870 Ko au
   total ; du WebP diviserait ça par deux. `bmw_original_front.png` (1,3 Mo) et
   `bmw_original_back.png` (1,5 Mo) sont chargés dans le configurateur : les passer en JPEG
   ou WebP est un gain immédiat, ce sont des fonds sans transparence.
3. **Un vrai rendu serveur** — le pré-rendu actuel ne pose que les balises `<head>`. Le corps
   des pages reste vide sans JavaScript. Google exécute le JS, donc ce n'est pas bloquant,
   mais un passage en SSR (Vite SSR ou Next.js) sécuriserait l'indexation et améliorerait
   nettement le LCP. Gros chantier : à envisager seulement si Search Console montre des
   problèmes de rendu.
4. **Image Open Graph par page** — `og.jpg` est la même partout. Une image dédiée par page
   améliore le taux de clic sur les partages.
5. **Suivi d'audience** — aucun outil n'est installé aujourd'hui. Si vous en ajoutez un,
   préférez une solution sans cookie (Plausible, Matomo sans cookie) : pas de bandeau de
   consentement à gérer, et la politique de confidentialité reste valable telle quelle. Avec
   Google Analytics, il faudra ajouter un vrai bandeau CMP et mettre à jour la section
   « Cookies » de `/confidentialite`.

---

## 4. À ne pas faire

- Gonfler `reviewCount` ou `ratingValue` dans `src/lib/reviews.ts` ou dans `index.html`.
  Le chiffre doit correspondre à la fiche Google : c'est vérifié automatiquement et une
  sanction manuelle supprime les étoiles pour des mois.
- Écrire des avis fictifs. Pratique commerciale trompeuse : jusqu'à 300 000 € d'amende et
  2 ans d'emprisonnement (art. L132-2 C. conso), sans compter la suppression de la fiche.
- Ajouter une réponse dans le JSON-LD `FAQPage` qui n'apparaît pas à l'écran. C'est pour ça
  que `FAQ_ITEMS` (dans `TrustSections.tsx`) alimente à la fois l'affichage et le balisage.
- Bourrer les textes de « vitres teintées Strasbourg ». La densité de mots-clés n'est plus un
  critère depuis longtemps ; la lisibilité, si.
- Dupliquer une page ville en changeant juste le nom de la commune.

---

## 5. Où toucher quoi

| Ce que vous voulez changer | Fichier |
|---|---|
| SIRET, TVA, assurance, médiateur, hébergeur | `src/lib/legal.ts` |
| Note Google, nombre d'avis, avis affichés | `src/lib/reviews.ts` |
| Questions / réponses de la FAQ (affichage **et** JSON-LD) | `src/features/landing/TrustSections.tsx` → `FAQ_ITEMS` |
| Arguments « Pourquoi nous » et engagements | `src/features/landing/TrustSections.tsx` → `WHY`, `PLEDGES` |
| Titre et description d'une page | `scripts/seo-routes.mjs` **et** le `useSeo()` de la page |
| Ajouter une page publique au sitemap et au pré-rendu | `scripts/seo-routes.mjs` |
| JSON-LD entreprise, horaires, coordonnées GPS | `index.html` |
| Communes desservies | `src/lib/site.ts` → `SERVICE_AREA` |
| Domaine canonique | variable d'env `VITE_SITE_URL` (+ `index.html` pour le JSON-LD) |
| Redirections, cache, compression | `public/.htaccess` |

Après toute modification : `npm run build`, puis déployer le contenu de `dist/`
(`.htaccess` compris — vérifier que le client FTP n'ignore pas les fichiers cachés).
