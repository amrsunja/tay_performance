/* Coordonnées de l'atelier — repli statique.

   La valeur affichée vient de app_settings (admin → Config) partout où c'est possible ;
   ceci n'est que le repli quand la requête n'a pas encore répondu.

   ⚠ Vit ici et pas dans AddressPage : le footer en a besoin sur toutes les pages, et
   l'importer depuis une page chargée à la demande ramènerait cette page entière dans
   le bundle principal. */
export const WORKSHOP = {
  name: 'Tay Performance',
  street: "19 Rue de l'Industrie",
  city: '67400 Illkirch-Graffenstaden',
  full: "19 Rue de l'Industrie, 67400 Illkirch-Graffenstaden",
} as const

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${WORKSHOP.name}, ${address}`)}`
}
