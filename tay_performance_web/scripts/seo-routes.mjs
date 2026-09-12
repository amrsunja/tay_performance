/* Source unique des routes PUBLIQUES du site.
   Utilisée par scripts/prerender.mjs (génération des index.html par route) et par
   scripts/sitemap.mjs (génération de public/sitemap.xml).

   ⚠ Une nouvelle page publique s'ajoute ICI, sinon elle n'aura ni balise <title>
   correcte au crawl, ni entrée dans le sitemap. Les routes privées (/garage,
   /reservations, /profil, /connexion, /admin*) ne doivent JAMAIS y figurer. */

export const SITE_URL = process.env.VITE_SITE_URL?.replace(/\/$/, '') || 'https://tayperformance.fr'

export const ROUTES = [
  {
    path: '/',
    title: 'Vitres teintées Strasbourg — prix en ligne et rendez-vous · Tay Performance (Illkirch 67400)',
    description:
      'Vitres teintées à Strasbourg (Illkirch, 67400) : prix calculé en ligne, créneau en 2 min, film découpé au véhicule. 5,0/5 sur 170 avis Google.',
    changefreq: 'weekly',
    priority: '1.0',
    image: '/og.jpg',
  },
  {
    path: '/reserver',
    title: 'Réserver une pose de vitres teintées en ligne — Strasbourg / Illkirch · Tay Performance',
    description:
      "Composez votre pose : véhicule, vitres, teinte. Le prix et la durée s'affichent en direct, vous choisissez un créneau réel. Sans compte, sans acompte.",
    changefreq: 'monthly',
    priority: '0.9',
  },
  {
    path: '/adresse',
    title: "Nous trouver — atelier vitres teintées à Illkirch-Graffenstaden (Strasbourg) · Tay Performance",
    description:
      "Tay Performance, 19 rue de l'Industrie, 67400 Illkirch-Graffenstaden, à 10 min de Strasbourg centre. Horaires, plan d'accès et parking sur place.",
    changefreq: 'monthly',
    priority: '0.7',
  },
  {
    path: '/mentions-legales',
    title: 'Mentions légales · Tay Performance',
    description:
      "Mentions légales de Tay Performance, atelier de vitres teintées à Illkirch-Graffenstaden : éditeur, hébergeur, propriété intellectuelle et responsabilité.",
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/confidentialite',
    title: 'Politique de confidentialité · Tay Performance',
    description:
      "Données collectées lors d'une réservation de vitres teintées, durée de conservation, sous-traitants, cookies et exercice de vos droits RGPD.",
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/cgv',
    title: "Conditions générales de vente et d'utilisation · Tay Performance",
    description:
      "Réservation en ligne d'une pose de vitres teintées, prix, annulation, garantie de pose, droit de rétractation et conformité au seuil de 70 % TLV.",
    changefreq: 'yearly',
    priority: '0.3',
  },
]
