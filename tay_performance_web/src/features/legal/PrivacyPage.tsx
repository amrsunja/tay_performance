/* /confidentialite — RGPD + LCEN. Décrit exactement ce que l'application collecte :
   compte anonyme Supabase, nom/téléphone/e-mail au moment de la réservation, véhicules
   du garage, photos de prestation, OTP SMS. Si le funnel change, cette page change. */
import LegalLayout, { Callout, legalStyles as s, type LegalSection } from './LegalLayout'
import { COMPANY, PROCESSORS, RETENTION } from '../../lib/legal'

const SECTIONS: LegalSection[] = [
  {
    id: 'principe',
    title: 'En résumé',
    body: (
      <>
        <Callout>
          <p>
            On ne collecte que ce qui sert à poser un film sur votre voiture : votre nom, un numéro pour vous
            joindre, un e-mail pour la confirmation, et les caractéristiques du véhicule. Pas de revente de
            données, pas de publicité ciblée, pas de traceur marketing. Vous pouvez réserver sans créer de compte
            ni de mot de passe.
          </p>
        </Callout>
        <p>
          Le responsable de traitement est <strong>{COMPANY.legalName}</strong> ({COMPANY.tradeName}),{' '}
          {COMPANY.address.full}. Contact : {COMPANY.email} — {COMPANY.phone}.
        </p>
      </>
    ),
  },
  {
    id: 'donnees',
    title: 'Données collectées et pourquoi',
    body: (
      <>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Donnée</th>
              <th>Quand</th>
              <th>Pourquoi</th>
              <th>Base légale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Identifiant de session anonyme</td>
              <td>À la première action nécessitant une identité (blocage d'un créneau, ajout d'un véhicule)</td>
              <td>Rattacher votre configuration et vos réservations à un même visiteur, sans compte</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Nom, téléphone, e-mail</td>
              <td>Au moment de valider un créneau</td>
              <td>Confirmer le rendez-vous, vous prévenir d'un changement, vous joindre le jour J</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Véhicule (marque, modèle, génération, carrosserie, immatriculation si vous la saisissez)</td>
              <td>Configurateur et « Mon garage »</td>
              <td>Calculer la surface vitrée, le prix et la durée ; retrouver votre véhicule pour une prochaine pose</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Détail de la prestation, remarques libres, historique</td>
              <td>Réservation</td>
              <td>Préparer le travail, assurer le suivi et la garantie</td>
              <td>Exécution du contrat / intérêt légitime</td>
            </tr>
            <tr>
              <td>Photos avant / après prises à l'atelier</td>
              <td>Pendant la prestation</td>
              <td>Traçabilité de l'état du véhicule et suivi de garantie</td>
              <td>Intérêt légitime</td>
            </tr>
            <tr>
              <td>Code de vérification par SMS</td>
              <td>Si vous choisissez de sécuriser votre compte</td>
              <td>Vérifier que le numéro est bien le vôtre et retrouver vos réservations sur un autre appareil</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Journaux techniques (adresse IP, horodatage, erreurs)</td>
              <td>À chaque visite</td>
              <td>Sécurité du service, détection d'abus, correction de bugs</td>
              <td>Intérêt légitime</td>
            </tr>
          </tbody>
        </table>
        <p>
          Aucune donnée de paiement n'est collectée sur le site : le règlement se fait à l'atelier. Aucune donnée
          sensible au sens de l'article 9 du RGPD n'est traitée.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies et stockage local',
    body: (
      <>
        <p>
          Le site n'utilise <strong>aucun cookie publicitaire ni aucun traceur d'audience tiers</strong>. Il
          n'affiche donc pas de bandeau de consentement, conformément à la dispense prévue par la CNIL pour les
          traceurs strictement nécessaires.
        </p>
        <ul>
          <li>
            <strong>Session Supabase</strong> — stockée dans le navigateur (localStorage) pour vous garder connecté
            à votre garage et à vos réservations. Strictement nécessaire.
          </li>
          <li>
            <strong>Brouillon de réservation</strong> — votre configuration en cours, conservée localement pour que
            vous ne perdiez rien si vous rechargez la page. Strictement nécessaire.
          </li>
          <li>
            <strong>Google Maps</strong> — la carte de la page « Nous trouver » est un contenu intégré de Google
            qui peut déposer ses propres cookies dès son chargement. Si vous ne souhaitez pas les recevoir,
            n'ouvrez pas cette page et utilisez directement l'adresse indiquée en pied de page.
          </li>
        </ul>
        <p>Vous pouvez effacer ces données à tout moment en vidant le stockage du site dans votre navigateur.</p>
      </>
    ),
  },
  {
    id: 'destinataires',
    title: 'Qui a accès à vos données',
    body: (
      <>
        <p>
          Vos données sont accessibles à l'équipe de l'atelier et aux prestataires techniques ci-dessous, qui
          agissent comme sous-traitants au sens de l'article 28 du RGPD et n'ont pas le droit de les utiliser pour
          leur propre compte. Elles ne sont ni vendues, ni louées, ni cédées à des tiers.
        </p>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Prestataire</th>
              <th>Rôle</th>
              <th>Localisation</th>
            </tr>
          </thead>
          <tbody>
            {PROCESSORS.map((p) => (
              <tr key={p.name}>
                <td>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.name}
                  </a>
                </td>
                <td>{p.role}</td>
                <td>{p.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Les transferts hors Union européenne (envoi d'e-mails et de SMS) sont encadrés par les clauses
          contractuelles types adoptées par la Commission européenne.
        </p>
      </>
    ),
  },
  {
    id: 'duree',
    title: 'Combien de temps on les garde',
    body: (
      <table className={s.table}>
        <thead>
          <tr>
            <th>Donnée</th>
            <th>Durée de conservation</th>
          </tr>
        </thead>
        <tbody>
          {RETENTION.map(([what, how]) => (
            <tr key={what}>
              <td>{what}</td>
              <td>{how}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
  {
    id: 'droits',
    title: 'Vos droits',
    body: (
      <>
        <p>Vous disposez à tout moment des droits suivants sur vos données :</p>
        <ul>
          <li>
            <strong>Accès</strong> — obtenir une copie de ce qui est enregistré à votre sujet.
          </li>
          <li>
            <strong>Rectification</strong> — corriger une information erronée. Vos coordonnées et vos véhicules
            sont directement modifiables depuis « Mon profil » et « Mon garage ».
          </li>
          <li>
            <strong>Effacement</strong> — demander la suppression de votre compte et de vos données, sous réserve
            des obligations comptables qui imposent de conserver les factures 10 ans.
          </li>
          <li>
            <strong>Limitation et opposition</strong> — vous opposer à un traitement fondé sur l'intérêt légitime,
            notamment l'usage de photos de votre véhicule.
          </li>
          <li>
            <strong>Portabilité</strong> — récupérer vos données dans un format lisible par machine.
          </li>
        </ul>
        <p>
          Pour exercer un droit, écrivez à {COMPANY.email} ou appelez le {COMPANY.phone}. Une réponse vous est
          apportée dans un délai maximum d'un mois. Si la réponse ne vous convient pas, vous pouvez saisir la CNIL
          — 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 —{' '}
          <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer">
            cnil.fr/fr/plaintes
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'securite',
    title: 'Sécurité',
    body: (
      <>
        <p>
          Les échanges avec le site sont chiffrés en HTTPS. L'accès aux données est cloisonné au niveau de la base
          par des règles de sécurité au niveau des lignes (Row Level Security) : un client ne peut techniquement
          lire que ses propres réservations et ses propres véhicules. L'accès administrateur est protégé par mot de
          passe et double authentification.
        </p>
        <p>
          En cas de violation de données susceptible d'engendrer un risque pour vos droits, la CNIL est notifiée
          sous 72 heures et vous êtes informé directement.
        </p>
      </>
    ),
  },
  {
    id: 'modification',
    title: 'Modification de cette politique',
    body: (
      <p>
        Cette politique peut évoluer avec le service. La date de dernière mise à jour figure en haut de page. En cas
        de changement substantiel touchant vos droits, vous en êtes informé par e-mail si nous disposons de votre
        adresse.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalLayout
      kicker="Données personnelles · RGPD"
      title="Politique de confidentialité"
      lede="Ce que le site enregistre, pourquoi, combien de temps, et comment vous faites supprimer tout ça en une demande."
      seoTitle="Politique de confidentialité"
      seoDescription="Politique de confidentialité de Tay Performance : données collectées lors d'une réservation de vitres teintées, durée de conservation, sous-traitants, cookies et exercice de vos droits RGPD."
      path="/confidentialite"
      sections={SECTIONS}
    />
  )
}
