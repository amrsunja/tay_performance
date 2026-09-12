/* /cgv — conditions générales de vente et d'utilisation. Le site ne prend pas de
   paiement : une réservation est une DEMANDE de créneau, confirmée ensuite par l'atelier.
   Toute la rédaction part de ce fait — ne pas la modifier sans changer le funnel. */
import LegalLayout, { Callout, legalStyles as s, type LegalSection } from './LegalLayout'
import { COMPANY, MEDIATOR } from '../../lib/legal'

const SECTIONS: LegalSection[] = [
  {
    id: 'objet',
    title: 'Objet et acceptation',
    body: (
      <>
        <p>
          Les présentes conditions régissent l'utilisation du site {COMPANY.tradeName} et la réservation en ligne
          d'une prestation à l'atelier situé {COMPANY.address.full}. Réserver un créneau vaut acceptation de ces
          conditions.
        </p>
        <p>
          Le prestataire est {COMPANY.legalName}, SIREN {COMPANY.siren}. Le client est toute personne physique ou
          morale réservant une prestation, à titre de particulier ou de professionnel.
        </p>
      </>
    ),
  },
  {
    id: 'prestations',
    title: 'Prestations proposées',
    body: (
      <>
        <ul>
          <li>
            <strong>Vitres teintées</strong> — pose de films découpés au format du véhicule, à l'intérieur du
            vitrage. Teintes de 5 % à 70 % de transmission lumineuse (TLV). Zones : pare-brise, vitres latérales
            avant, vitres latérales arrière, lunette arrière, bande pare-soleil.
          </li>
          <li>
            <strong>Covering</strong> — habillage total ou partiel de la carrosserie.
          </li>
          <li>
            <strong>Sellerie</strong> — rénovation et personnalisation de l'habitacle.
          </li>
          <li>
            <strong>Detailing</strong> — rénovation esthétique, polissage, décontamination, protection céramique.
          </li>
          <li>
            <strong>Éclairage intérieur</strong> — installation d'éclairage d'ambiance.
          </li>
        </ul>
        <p>
          Seules les vitres teintées sont configurables et chiffrables en ligne. Les autres prestations font l'objet
          d'un devis établi à l'atelier après examen du véhicule.
        </p>
      </>
    ),
  },
  {
    id: 'reservation',
    title: 'Réservation en ligne',
    body: (
      <>
        <Callout>
          <p>
            <strong>Une réservation en ligne est une demande de créneau, pas une commande ferme.</strong> Le
            créneau est bloqué immédiatement dans l'agenda, puis l'atelier le confirme et vous recevez un e-mail de
            validation. Aucun paiement ni acompte n'est demandé sur le site.
          </p>
        </Callout>
        <ol>
          <li>Vous sélectionnez votre véhicule : marque, modèle, génération, carrosserie.</li>
          <li>Vous choisissez les vitres à traiter et la teinte. Le prix et la durée s'affichent en direct.</li>
          <li>Vous choisissez un créneau réellement disponible et laissez vos coordonnées.</li>
          <li>L'atelier valide la demande et vous confirme par e-mail.</li>
        </ol>
        <p>
          Le créneau réservé est temporairement bloqué pour vous. Passé le délai de blocage sans validation des
          coordonnées, il est automatiquement remis à la disposition des autres clients.
        </p>
        <p>
          Si votre véhicule ne figure pas au catalogue ou nécessite un examen particulier, la demande est
          enregistrée sans prix : l'atelier vous rappelle pour fixer le tarif avant toute intervention.
        </p>
      </>
    ),
  },
  {
    id: 'prix',
    title: 'Prix et paiement',
    body: (
      <>
        <p>
          Les prix affichés par le configurateur sont exprimés en euros, toutes taxes comprises, et calculés à
          partir de la carrosserie, des zones sélectionnées et de la teinte choisie. Ils constituent une{' '}
          <strong>estimation ferme sous réserve de l'état réel du véhicule</strong>.
        </p>
        <p>Le prix peut être revu, avec votre accord préalable et avant toute intervention, si :</p>
        <ul>
          <li>un film ancien doit être retiré du vitrage ;</li>
          <li>le vitrage est fissuré, ébréché, ou comporte un capteur, un chauffage ou une antenne particulière ;</li>
          <li>la carrosserie déclarée ne correspond pas au véhicule présenté ;</li>
          <li>l'habitacle nécessite un démontage inhabituel.</li>
        </ul>
        <p>
          Le règlement s'effectue à l'atelier, à la fin de la prestation. Une facture vous est remise. Aucune donnée
          bancaire n'est saisie ni conservée sur le site.
        </p>
      </>
    ),
  },
  {
    id: 'rdv',
    title: 'Le jour du rendez-vous',
    body: (
      <>
        <p>
          Présentez le véhicule à l'heure convenue, vitres propres et habitacle dégagé aux abords des portes. Un
          retard supérieur à 20 minutes peut entraîner le report du rendez-vous, l'atelier travaillant sur des
          créneaux enchaînés.
        </p>
        <p>
          Vous pouvez laisser le véhicule ou patienter sur place : l'atelier dispose d'une salle d'attente. Comptez
          généralement 1 h à 3 h selon les zones traitées ; la durée estimée est indiquée lors de la réservation.
        </p>
        <Callout>
          <p>
            <strong>Séchage.</strong> Un film fraîchement posé contient encore de l'eau. Ne descendez pas les
            vitres pendant les 3 à 5 jours suivant la pose, et évitez le nettoyage du vitrage à l'ammoniaque. De
            légers voiles ou micro-bulles d'eau peuvent apparaître les premiers jours puis disparaître seuls au
            séchage.
          </p>
        </Callout>
      </>
    ),
  },
  {
    id: 'annulation',
    title: 'Annulation, report et retard',
    body: (
      <>
        <p>
          Vous pouvez annuler ou reprogrammer votre rendez-vous depuis l'espace « Mes réservations », ou par
          téléphone au {COMPANY.phone}. Nous vous demandons de prévenir au moins 24 heures à l'avance afin que le
          créneau puisse être proposé à un autre client.
        </p>
        <p>
          Aucun acompte n'étant versé, une annulation n'entraîne aucun frais. L'atelier se réserve le droit de
          reporter un rendez-vous en cas d'imprévu technique et vous en informe dès que possible.
        </p>
      </>
    ),
  },
  {
    id: 'retractation',
    title: 'Droit de rétractation',
    body: (
      <>
        <p>
          La réservation étant conclue à distance, le consommateur dispose en principe d'un délai de rétractation de
          14 jours (art. L221-18 du Code de la consommation).
        </p>
        <Callout warn>
          <p>
            Conformément à l'article L221-25 du même code, si vous demandez expressément que la prestation soit
            exécutée avant la fin de ce délai — ce qui est le cas dès lors que vous réservez un créneau situé dans
            les 14 jours — <strong>le droit de rétractation s'éteint une fois la prestation pleinement exécutée</strong>.
            Avant l'intervention, vous pouvez annuler librement et sans frais.
          </p>
        </Callout>
      </>
    ),
  },
  {
    id: 'garantie',
    title: 'Garantie et réclamations',
    body: (
      <>
        <p>
          La pose est garantie contre les défauts qui lui sont imputables : décollement, bullage persistant après
          séchage, plis, voile durable. Si un défaut apparaît, ramenez le véhicule à l'atelier — le film concerné
          est reposé sans frais.
        </p>
        <p>La garantie ne couvre pas :</p>
        <ul>
          <li>les rayures et déchirures dues à une utilisation, un nettoyage abrasif ou un objet dans la portière ;</li>
          <li>l'ouverture des vitres pendant la période de séchage ;</li>
          <li>l'usage de produits ammoniaqués sur la face intérieure du vitrage ;</li>
          <li>un vitrage déjà endommagé au moment de la pose ;</li>
          <li>le retrait du film par un tiers.</li>
        </ul>
        <p>
          Le client bénéficie en tout état de cause de la garantie légale de conformité (art. L217-3 et suivants du
          Code de la consommation) et de la garantie contre les vices cachés (art. 1641 du Code civil).
        </p>
        <p>
          La garantie éventuelle du fabricant du film s'ajoute à celle de la pose ; sa durée dépend de la gamme
          posée et vous est indiquée à l'atelier.
        </p>
      </>
    ),
  },
  {
    id: 'conformite',
    title: 'Conformité réglementaire du vitrage',
    body: (
      <>
        <p>
          En France, le pare-brise et les vitres latérales avant doivent laisser passer au moins 70 % de la lumière
          (décret n° 2016-448 du 13 avril 2016, art. R316-3 du Code de la route). Le vitrage arrière et la lunette
          ne sont pas soumis à ce seuil.
        </p>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Zone</th>
              <th>Règle</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pare-brise</td>
              <td>TLV ≥ 70 % — bande pare-soleil tolérée en haut de vitrage</td>
            </tr>
            <tr>
              <td>Vitres latérales avant</td>
              <td>TLV ≥ 70 %</td>
            </tr>
            <tr>
              <td>Vitres latérales arrière</td>
              <td>Libre</td>
            </tr>
            <tr>
              <td>Lunette arrière</td>
              <td>Libre</td>
            </tr>
          </tbody>
        </table>
        <p>
          Le configurateur signale toute configuration non conforme. Si vous demandez malgré tout une pose sous les
          70 % à l'avant, vous devez le confirmer explicitement : la prestation est alors réputée destinée à un
          usage hors voie publique et l'atelier décline toute responsabilité en cas de contrôle, d'amende (135 € et
          retrait de 3 points) ou de refus au contrôle technique.
        </p>
      </>
    ),
  },
  {
    id: 'vehicule',
    title: 'Véhicule confié',
    body: (
      <>
        <p>
          L'état du véhicule est constaté à l'arrivée et à la restitution ; des photographies peuvent être prises à
          des fins de traçabilité. Signalez tout défaut de vitrage préexistant avant l'intervention.
        </p>
        <p>
          Retirez les objets de valeur de l'habitacle : l'atelier ne peut être tenu responsable des effets
          personnels laissés dans le véhicule. Le véhicule doit être en état de circuler et assuré.
        </p>
        <p>
          Un véhicule non récupéré après la fin de la prestation reste sous la responsabilité de son propriétaire.
        </p>
      </>
    ),
  },
  {
    id: 'compte',
    title: 'Compte client et usage du site',
    body: (
      <>
        <p>
          Le site est utilisable sans compte : une session anonyme est créée automatiquement pour rattacher votre
          réservation. Vous pouvez ensuite lier un numéro de téléphone pour retrouver votre historique sur un autre
          appareil.
        </p>
        <p>
          Vous vous engagez à fournir des informations exactes et à ne pas perturber le fonctionnement du service
          (réservations fictives, tentatives d'accès à des données tierces, automatisation abusive). L'atelier peut
          annuler une réservation manifestement frauduleuse.
        </p>
        <p>
          Le traitement de vos données est décrit dans la <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </>
    ),
  },
  {
    id: 'litiges',
    title: 'Réclamations, médiation et droit applicable',
    body: (
      <>
        <p>
          Toute réclamation doit d'abord être adressée à l'atelier : {COMPANY.email} — {COMPANY.phone}. Nous nous
          engageons à répondre sous 14 jours.
        </p>
        <p>
          À défaut de solution amiable, le consommateur peut recourir gratuitement à un médiateur de la
          consommation : {MEDIATOR.name} — {MEDIATOR.url}. La plateforme européenne de règlement en ligne des
          litiges est également accessible sur{' '}
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">
            ec.europa.eu/consumers/odr
          </a>
          .
        </p>
        <p>
          Les présentes conditions sont soumises au droit français. À défaut d'accord amiable, le litige relève des
          juridictions compétentes.
        </p>
      </>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalLayout
      kicker="Conditions générales"
      title="Conditions de vente"
      lede="Comment se passe une réservation, ce qui est garanti, ce qui ne l'est pas, et ce que dit la loi sur la teinte des vitres avant."
      seoTitle="Conditions générales de vente et d'utilisation"
      seoDescription="CGV de Tay Performance : réservation en ligne d'une pose de vitres teintées, prix, annulation, garantie de pose, droit de rétractation et conformité au seuil de 70 % TLV."
      path="/cgv"
      sections={SECTIONS}
    />
  )
}
