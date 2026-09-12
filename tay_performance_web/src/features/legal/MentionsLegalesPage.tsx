/* /mentions-legales — obligation art. 6-III de la LCEN. Toutes les valeurs viennent
   de src/lib/legal.ts : on ne réécrit jamais une donnée société en dur ici. */
import LegalLayout, { Callout, Facts, type LegalSection } from './LegalLayout'
import { COMPANY, HOST } from '../../lib/legal'
import { DEVELOPER, SITE_URL, portfolioUrl } from '../../lib/site'

const SECTIONS: LegalSection[] = [
  {
    id: 'editeur',
    title: "Éditeur du site",
    body: (
      <>
        <p>
          Le site {SITE_URL.replace('https://', '')} est édité par l'exploitant de l'atelier{' '}
          <strong>{COMPANY.tradeName}</strong>.
        </p>
        <Facts
          rows={[
            ['Raison sociale', COMPANY.legalName],
            ['Enseigne', COMPANY.tradeName],
            ['Forme juridique', COMPANY.legalForm],
            ['Capital social', COMPANY.capital],
            ['Siège / atelier', COMPANY.address.full],
            ['SIREN', COMPANY.siren],
            ['SIRET', COMPANY.siret],
            ['Immatriculation', COMPANY.registry],
            ['Code APE / NAF', COMPANY.ape],
            ['TVA intracommunautaire', COMPANY.vat],
            ['Téléphone', COMPANY.phone],
            ['E-mail', COMPANY.email],
            ['Directeur de la publication', COMPANY.publisher],
          ]}
        />
        <p>
          Assurance responsabilité civile professionnelle : {COMPANY.insurance}
        </p>
      </>
    ),
  },
  {
    id: 'hebergeur',
    title: 'Hébergeur',
    body: (
      <>
        <p>Le site est hébergé par :</p>
        <Facts
          rows={[
            ['Société', HOST.name],
            ['Adresse', HOST.address],
            ['Téléphone', HOST.phone],
            ['Site', HOST.url],
          ]}
        />
        <p>
          Les données applicatives (comptes clients, réservations, véhicules, photos de prestation) sont hébergées
          par <strong>Supabase Inc.</strong> sur une infrastructure située dans l'Union européenne. Le détail des
          sous-traitants figure dans la{' '}
          <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </>
    ),
  },
  {
    id: 'activite',
    title: "Activité de l'atelier",
    body: (
      <>
        <p>
          {COMPANY.tradeName} est un atelier de personnalisation automobile situé à Illkirch-Graffenstaden, dans
          l'Eurométropole de Strasbourg. Prestations proposées : pose de films teintés sur vitrage automobile,
          covering, sellerie, detailing, éclairage intérieur et polissage d'optiques.
        </p>
        <Callout warn>
          <p>
            <strong>Réglementation vitres teintées.</strong> Depuis le décret n° 2016-448 du 13 avril 2016, le
            pare-brise et les vitres latérales avant d'un véhicule circulant en France doivent laisser passer au
            moins 70 % de la lumière (TLV ≥ 70 %). L'atelier applique cette règle et le configurateur en ligne la
            signale automatiquement. Une pose en dessous de ce seuil sur les vitres avant est réservée à un usage
            hors voie publique (circuit, exposition, véhicule non immatriculé en France) et engage la seule
            responsabilité du client.
          </p>
        </Callout>
      </>
    ),
  },
  {
    id: 'propriete',
    title: 'Propriété intellectuelle',
    body: (
      <>
        <p>
          L'ensemble du site — structure, code, textes, photographies, vidéos, logotype et identité visuelle — est
          protégé par le droit d'auteur. Toute reproduction, représentation ou réutilisation, totale ou partielle,
          sans autorisation écrite préalable est interdite.
        </p>
        <p>
          Les photographies et vidéos de réalisations publiées sur le site ont été prises à l'atelier et
          représentent des prestations réellement effectuées. Les marques et modèles de véhicules cités restent la
          propriété de leurs titulaires respectifs et ne sont mentionnés qu'à titre descriptif.
        </p>
        <p>
          Conception et développement du site :{' '}
          <a href={portfolioUrl('meta')} target="_blank" rel="noreferrer">
            {DEVELOPER.name}
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'responsabilite',
    title: 'Responsabilité',
    body: (
      <>
        <p>
          Les informations publiées (prestations, délais, tarifs indicatifs du configurateur) sont fournies à titre
          informatif et peuvent évoluer. Le prix et la durée définitifs sont ceux confirmés par l'atelier après
          examen du véhicule.
        </p>
        <p>
          L'éditeur ne peut être tenu responsable d'une interruption temporaire du site, d'une erreur matérielle,
          ni du contenu des sites tiers accessibles par lien hypertexte (Instagram, TikTok, Facebook, Google Maps).
        </p>
      </>
    ),
  },
  {
    id: 'litiges',
    title: 'Droit applicable et litiges',
    body: (
      <>
        <p>
          Les présentes mentions légales sont soumises au droit français. En cas de litige et à défaut de résolution
          amiable, les tribunaux français sont compétents.
        </p>
        <p>
          Pour toute réclamation, écrivez d'abord à l'atelier : {COMPANY.email} — ou par téléphone au{' '}
          {COMPANY.phone}. Les voies de recours du consommateur sont détaillées dans les{' '}
          <a href="/cgv">conditions générales de vente</a>.
        </p>
      </>
    ),
  },
]

export default function MentionsLegalesPage() {
  return (
    <LegalLayout
      kicker="Informations légales"
      title="Mentions légales"
      lede="Qui édite ce site, qui l'héberge, et à qui vous vous adressez quand vous réservez une pose chez Tay Performance."
      seoTitle="Mentions légales"
      seoDescription="Mentions légales de Tay Performance, atelier de vitres teintées, covering et detailing à Illkirch-Graffenstaden (Strasbourg) : éditeur, hébergeur, propriété intellectuelle et responsabilité."
      path="/mentions-legales"
      sections={SECTIONS}
    />
  )
}
