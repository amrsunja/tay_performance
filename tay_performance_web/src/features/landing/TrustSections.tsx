/* Les trois blocs de réassurance de la landing : avis Google réels, « pourquoi nous »
   + engagements, et la FAQ visible.

   ⚠ FAQ_ITEMS est la source unique : la section affichée ET le JSON-LD FAQPage lisent
   ce tableau. Google supprime un rich result dont la réponse n'apparaît pas à l'écran —
   ne jamais dupliquer ces textes ailleurs. */
import { Link } from 'react-router-dom'
import SectionTag from '../../components/ui/SectionTag'
import Icon, { type IconName } from '../../components/ui/Icon'
import { GOOGLE, RATING_FR, REVIEWS } from '../../lib/reviews'
import styles from './landing.module.css'

/* ============================================================ avis Google */

function Stars({ size = 15 }: { size?: number }) {
  return (
    <span className={styles.reviewStars} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name="star" size={size} />
      ))}
    </span>
  )
}

export function ReviewsSection() {
  return (
    <section id="avis" className={styles.sectionAlt}>
      <div className={styles.inner}>
        <div className={styles.sectionHead} style={{ marginBottom: 32 }}>
          <div data-reveal data-anim="left">
            <SectionTag gradient="linear-gradient(90deg,#FF9E1B,#29ABE2)">Avis clients</SectionTag>
            <h2 className={`sat ${styles.h2}`}>
              {GOOGLE.reviewCount} avis Google,
              <br />
              aucun en dessous de 5 étoiles
            </h2>
          </div>
          <a
            href={GOOGLE.placeUrl}
            target="_blank"
            rel="noreferrer"
            data-reveal
            data-anim="right"
            className={`navlink ${styles.sectionHeadLink}`}
          >
            Voir la fiche Google <Icon name="external" size={15} />
          </a>
        </div>

        <div data-reveal className={styles.ratingBar}>
          <span className={`clash ${styles.ratingScore}`}>
            {RATING_FR}
            <small>/ 5</small>
          </span>
          <span className={styles.ratingMeta}>
            <Stars size={17} />
            <span className={styles.ratingMetaStrong}>{GOOGLE.reviewCount} avis Google vérifiables</span>
            <span>Note relevée sur la fiche Google Business le 12 septembre 2026</span>
          </span>
          <span className={styles.ratingSpacer} />
          <a
            href={GOOGLE.reviewUrl}
            target="_blank"
            rel="noreferrer"
            className="ghost"
            style={{ fontSize: 14, padding: '12px 20px', borderRadius: 12, fontWeight: 500 }}
          >
            Laisser un avis
          </a>
        </div>

        <div className={styles.reviewGrid}>
          {REVIEWS.slice(0, 3).map((review, i) => (
            <figure key={review.author} className={styles.reviewCard} data-reveal data-delay={90 * i}>
              <Stars />
              <blockquote className={styles.reviewText}>« {review.excerpt} »</blockquote>
              <figcaption className={styles.reviewFoot}>
                <span className={`sat ${styles.reviewAuthor}`}>{review.author}</span>
                <span className={`mono ${styles.reviewWhen}`}>{review.when}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className={styles.reviewsFooter} data-reveal>
          <Link to="/reserver" className="cta" style={{ fontSize: 15, padding: '15px 26px' }}>
            Voir mon prix <Icon name="arrow-right" size={17} />
          </Link>
          <span style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>
            Avis publiés sur Google et non modifiables par l'atelier.
          </span>
        </div>
      </div>
    </section>
  )
}

/* ============================================================ pourquoi nous */

const WHY: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'euro',
    title: 'Le prix avant de décrocher le téléphone',
    body: "Le configurateur calcule le tarif à partir de votre carrosserie, des vitres choisies et de la teinte. Pas de fourchette, pas de « ça dépend » : le montant s'affiche avant que vous réserviez.",
  },
  {
    icon: 'calendar',
    title: "L'agenda réel de l'atelier",
    body: "Vous voyez les créneaux libres tels qu'ils sont. Celui que vous prenez est bloqué immédiatement, l'atelier le valide et vous recevez la confirmation par e-mail. Personne ne peut réserver par-dessus vous.",
  },
  {
    icon: 'car',
    title: 'Films découpés à votre véhicule',
    body: "Découpe au format exact de chaque vitre, pose par l'intérieur, joints repoussés. C'est ce qui évite les bulles, les bords qui pèlent et les angles qui blanchissent au bout d'un an.",
  },
  {
    icon: 'warning',
    title: 'La teinte légale, dite avant la pose',
    body: "Le configurateur signale tout ce qui passe sous 70 % de transmission lumineuse à l'avant. Vous savez ce qui est autorisé avant de réserver, pas au moment du contrôle.",
  },
  {
    icon: 'map-pin',
    title: 'Salle d\'attente, ou vous repassez',
    body: "Comptez 1 h à 3 h selon les vitres. Canapé, télé et café si vous préférez rester sur place. Sinon vous déposez la voiture et vous revenez à l'heure convenue.",
  },
  {
    icon: 'star',
    title: 'Un atelier, pas un intermédiaire',
    body: "Tout est fait sur place, 19 rue de l'Industrie à Illkirch-Graffenstaden, à 10 minutes de Strasbourg centre. Vous parlez directement à la personne qui pose le film.",
  },
]

const PLEDGES = [
  "Une bulle ou un pli qui persiste après séchage ? Le film est reposé sans frais.",
  "Le prix affiché en ligne est celui que vous payez — sauf ancien film à retirer ou vitrage abîmé, signalé et validé avec vous avant de commencer.",
  'Aucun acompte, aucune carte bancaire sur le site : vous réglez à l\'atelier, une fois le travail fait.',
  'Annulation ou report libre jusqu\'à 24 h avant, depuis votre espace ou par téléphone.',
  "État du véhicule constaté et photographié à l'arrivée comme à la restitution.",
  'Garantie légale de conformité et garantie du fabricant du film, en plus de la garantie de pose.',
]

export function WhyUsSection() {
  return (
    <section id="pourquoi" className={styles.section}>
      <div className={styles.inner}>
        <div data-reveal className={styles.processHead}>
          <SectionTag gradient="linear-gradient(90deg,#29ABE2,#FF9E1B)" centered>
            Pourquoi Tay Performance
          </SectionTag>
          <h2 className={`sat ${styles.h2}`}>Ce que vous saurez avant de venir</h2>
        </div>

        <div className={styles.whyGrid}>
          {WHY.map((item, i) => (
            <article key={item.title} className={styles.whyCard} data-reveal data-delay={70 * i}>
              <span className={styles.whyIcon}>
                <Icon name={item.icon} size={21} />
              </span>
              <h3 className="sat">{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className={styles.pledgeCard} data-reveal>
          <h3 className={`sat ${styles.pledgeTitle}`}>Nos engagements, écrits noir sur blanc</h3>
          <p className={styles.pledgeLede}>
            Six points sur lesquels vous pouvez nous tenir. Le détail complet est dans les{' '}
            <Link to="/cgv" className="navlink">
              conditions de vente
            </Link>
            .
          </p>
          <ul className={styles.pledgeList}>
            {PLEDGES.map((pledge) => (
              <li key={pledge} className={styles.pledgeItem}>
                <span className={styles.pledgeCheck} aria-hidden>
                  <Icon name="check" size={17} strokeWidth={2.4} />
                </span>
                <span>{pledge}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ============================================================ FAQ */

export interface FaqItem {
  q: string
  /** Réponse en texte brut — réutilisée telle quelle dans le JSON-LD. */
  a: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Les vitres teintées sont-elles légales en France ?',
    a: "Oui, à condition de respecter le seuil de transmission lumineuse. Depuis le décret du 13 avril 2016, le pare-brise et les deux vitres latérales avant doivent laisser passer au moins 70 % de la lumière. Les vitres latérales arrière et la lunette n'ont aucune limite : vous pouvez y poser du 5 %. Le configurateur en ligne applique cette règle automatiquement et vous prévient dès qu'une configuration sort des clous.",
  },
  {
    q: 'Combien coûte une pose de vitres teintées à Strasbourg ?',
    a: "Le prix dépend de trois choses : la carrosserie du véhicule (elle détermine la surface vitrée), les vitres que vous faites traiter et la teinte choisie. Plutôt que d'annoncer une fourchette, le configurateur calcule le montant exact pendant que vous composez votre pose, avant toute réservation et sans créer de compte.",
  },
  {
    q: 'Combien de temps dure la pose et faut-il laisser la voiture ?',
    a: "Comptez généralement 1 h à 3 h selon le nombre de vitres. La durée estimée s'affiche avec le prix au moment de la réservation. Vous pouvez laisser le véhicule et revenir, ou patienter à l'atelier : il y a une salle d'attente avec canapé, télé et café.",
  },
  {
    q: 'Peut-on teinter le pare-brise ?',
    a: "Le pare-brise doit rester à 70 % de transmission lumineuse minimum pour circuler en France. On peut donc y poser un film clair anti-chaleur ou un film à effet caméléon conforme, ainsi qu'une bande pare-soleil en haut de vitrage. Une teinte plus sombre sur le pare-brise est réservée à un usage hors voie publique.",
  },
  {
    q: 'Faut-il retirer un ancien film avant la pose ?',
    a: "Oui, un film neuf ne se pose jamais par-dessus un ancien. Le retrait fait partie des prestations de l'atelier ; c'est un travail long car la colle doit partir entièrement du vitrage, notamment sur une lunette arrière chauffante. Signalez-le à la réservation : le supplément vous est confirmé avant qu'on commence.",
  },
  {
    q: 'Quand puis-je rouvrir mes vitres après la pose ?',
    a: "Attendez 3 à 5 jours. Un film fraîchement posé contient encore de l'eau et descendre la vitre trop tôt décolle le bord. De légers voiles ou micro-bulles peuvent apparaître les premiers jours : ils disparaissent seuls au séchage. Évitez ensuite les nettoyants à l'ammoniaque sur la face intérieure du vitrage.",
  },
  {
    q: 'Un film teinté passe-t-il le contrôle technique ?',
    a: "Oui, si les vitres avant respectent les 70 % de transmission lumineuse. Une teinte trop sombre à l'avant constitue une défaillance majeure au contrôle technique et expose à une amende de 135 € avec retrait de 3 points. Tout ce que nous posons sur les vitres avant respecte ce seuil, sauf demande expresse de votre part pour un véhicule qui ne circule pas sur la voie publique.",
  },
  {
    q: 'Le film abîme-t-il le dégivrage, les antennes ou les capteurs ?',
    a: "Non. Le film se pose par-dessus les fils de dégivrage sans les endommager et les gammes que nous utilisons ne bloquent pas les signaux GPS, radio ou télépéage. Les zones de capteurs de pluie et d'aides à la conduite sont contournées lors de la découpe.",
  },
  {
    q: "Où se trouve l'atelier et faut-il prendre rendez-vous ?",
    a: "L'atelier est au 19 rue de l'Industrie, 67400 Illkirch-Graffenstaden, à 10 minutes de Strasbourg centre, avec parking sur place. Le rendez-vous est indispensable : les créneaux s'enchaînent dans la journée. Vous pouvez le prendre en ligne en quelques minutes ou par téléphone au 06 05 50 50 28.",
  },
]

export function FaqSection() {
  return (
    <section id="faq" className={styles.sectionAlt}>
      <div className={styles.inner}>
        <div className={styles.faqLayout}>
          <div data-reveal data-anim="left" className={styles.faqAside}>
            <SectionTag gradient="linear-gradient(90deg,#ED1C24,#FF9E1B)">Questions fréquentes</SectionTag>
            <h2 className={`sat ${styles.h2}`}>
              Les questions
              <br />
              qu'on nous pose tous les jours
            </h2>
            <div className={styles.faqAsideCard}>
              <p>
                Votre cas n'est pas dans la liste ? Appelez l'atelier, on répond entre deux poses — ou passez
                directement, l'adresse est sur la page « Nous trouver ».
              </p>
              <a
                href="tel:0605505028"
                className="ghost"
                style={{ fontSize: 14, padding: '12px 20px', borderRadius: 12, fontWeight: 500 }}
              >
                <Icon name="phone" size={16} /> 06 05 50 50 28
              </a>
            </div>
          </div>

          <div data-reveal data-anim="right" className={styles.faqList}>
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary className="sat">
                  {item.q}
                  <span className={styles.faqSign} aria-hidden />
                </summary>
                <p className={styles.faqAnswer}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
