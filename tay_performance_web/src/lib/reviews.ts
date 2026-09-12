/* Avis Google RÉELS, recopiés verbatim depuis la fiche Google Business le 12/09/2026.
   Source unique pour la section « Avis » de la landing ET pour le JSON-LD Review /
   AggregateRating. N'inventez jamais un avis ici : un faux avis est une pratique
   commerciale trompeuse (art. L121-2 C. conso) et Google déclasse le rich snippet.

   ⚠ Mettre à jour RATING / REVIEW_COUNT à chaque palier — un aggregateRating qui ne
   correspond pas à la fiche Google est un motif de suppression du rich result. */

export const GOOGLE = {
  /** Fiche Google Business — lien de partage court. */
  placeUrl: 'https://maps.app.goo.gl/SDoKBodNRucu2WKE8',
  /** Lien « laisser un avis ». ⚠ TODO : remplacer par le lien court fourni par Google
      Business Profile (Accueil → « Demander des avis »), qui ouvre directement le
      formulaire. En attendant, on renvoie sur la fiche. */
  reviewUrl: 'https://maps.app.goo.gl/SDoKBodNRucu2WKE8',
  rating: 5.0,
  reviewCount: 170,
  /** Relevé le : sert de dateModified pour le JSON-LD. */
  checkedOn: '2026-09-12',
} as const

export interface Review {
  author: string
  /** ISO date approximative (Google n'affiche qu'un mois). */
  date: string
  /** Mois affiché à l'écran. */
  when: string
  rating: 5
  /** Verbatim intégral. Ne pas réécrire ni corriger l'orthographe. */
  text: string
  /** Version courte affichée dans la carte, coupée sur une phrase entière. */
  excerpt: string
}

export const REVIEWS: Review[] = [
  {
    author: 'Salim Kherbache',
    date: '2026-04-01',
    when: 'Avril 2026',
    rating: 5,
    text: "Je suis allé à ce garage dans l'optique de faire teinter mes vitres avant et mon pare-brise en caméléon, que dire, Un accueil formidable avec une salle d'attente très confortable. Et le Patron, vraiment vraiment très sympa, avec un accueil digne d'un Garage des plus haut de gammes à des prix plus que correct. Pour ce qui est du travail effectué, la photo de la voiture parle d'elle-même. Un travail impeccable, sans bulle d'air et des films de qualité. Vraiment je reviendrai dans ce garage. Allez-y les yeux fermés",
    excerpt:
      "Un accueil digne d'un garage des plus haut de gammes à des prix plus que correct. Un travail impeccable, sans bulle d'air et des films de qualité. Allez-y les yeux fermés.",
  },
  {
    author: 'q S',
    date: '2026-06-01',
    when: 'Juin 2026',
    rating: 5,
    text: "Très satisfait du travail réalisé sur les vitres teintées de ma voiture. Le résultat est impeccable, propre et parfaitement posé, sans aucune bulle ni défaut. L'équipe est professionnelle, accueillante et de bon conseil. Le travail a été effectué dans les délais annoncés et avec beaucoup de soin. Je recommande ce garage à 100 % pour la qualité de son service et son sérieux. Merci encore !",
    excerpt:
      "Le résultat est impeccable, propre et parfaitement posé, sans aucune bulle ni défaut. Le travail a été effectué dans les délais annoncés et avec beaucoup de soin.",
  },
  {
    author: 'kola Z',
    date: '2026-06-01',
    when: 'Juin 2026',
    rating: 5,
    text: "J'ai fait teinter mon pare-brise en bleu. Du devis jusqu'à la réalisation, tout s'est très bien passé. L'équipe est très réactive et le résultat est vraiment bluffant, aucun défaut à signaler ! Petite salle d'attente sympathique, avec de quoi s'occuper pendant la prestation, et le café est offert. J'y retournerai sûrement prochainement pour faire teinter mes phares. Je recommande sans hésitation !",
    excerpt:
      "Du devis jusqu'à la réalisation, tout s'est très bien passé. Petite salle d'attente sympathique, avec de quoi s'occuper pendant la prestation, et le café est offert.",
  },
  {
    author: 'Adam Bersanov',
    date: '2026-02-01',
    when: 'Février 2026',
    rating: 5,
    text: "Deuxième passage chez Tay Performance et toujours aussi satisfait. Le gérant est passionné et minutieux. La pose des vitres teintées est impeccable, sans bulles ni défauts. Travail propre, sérieux et délais respectés. Je recommande les yeux fermés.",
    excerpt:
      "Deuxième passage chez Tay Performance et toujours aussi satisfait. Le gérant est passionné et minutieux. Travail propre, sérieux et délais respectés.",
  },
  {
    author: 'JSL Coiffure & Beauté',
    date: '2026-05-01',
    when: 'Mai 2026',
    rating: 5,
    text: "J'ai fait retirer mes anciennes vitres teintées avant sur mon Mercedes GLC noir puis poser une nouvelle teinte en 70 %, et le résultat est juste parfait. Travail très sérieux et pose impeccable.",
    excerpt:
      "Retrait des anciennes vitres teintées avant sur mon Mercedes GLC puis pose d'une nouvelle teinte en 70 % : le résultat est juste parfait.",
  },
]

/** Note affichée à la française : 5,0 */
export const RATING_FR = GOOGLE.rating.toFixed(1).replace('.', ',')
