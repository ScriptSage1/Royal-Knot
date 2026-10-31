// "Celebrations we love": wedding inspiration for prospective couples.
//
// Honesty rules for this content:
// - These are NOT Royal Knot client weddings. The photographs are openly
//   licensed images by independent photographers (see PHOTOS below and
//   public/img/inspiration/CREDITS.md), and each story is an idea inspired by
//   the photograph, written in the "imagine" voice. Pages say so.
// - Replace with verified, authorised client work ("Our weddings") only when
//   the team has permission to show it.

const PHOTOS = {
  'jaipur-courtyard': { author: 'Ji-Elle', licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:S%C3%A9ance_de_photos_de_mariage_%C3%A0_Jaipur_(4).jpg', alt: 'A bride in a flowing green dupatta rides in a red vintage open-top car through a rose-pink palace courtyard in Jaipur, with a photographer beside her.' },
  'jaipur-mehendi': { author: 'Apurv013', licence: 'CC0 1.0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', source: 'https://commons.wikimedia.org/wiki/File:Mahendi_.jpg', alt: 'Close-up of a hand with deep red mehendi, gold rings and bangles, resting on red and gold silk.' },
  'udaipur-garden': { author: 'Mustang Joe', licence: 'CC0 1.0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', source: 'https://commons.wikimedia.org/wiki/File:Saheliyon-ki-Bari,_Udaipur,_India_(54345395621).jpg', alt: 'A white marble pavilion rises from a blue fountain pool in a heritage garden in Udaipur, framed by pink bougainvillea and palms.' },
  'udaipur-florals': { author: 'Megh Banthia', licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:Sustainable_flower_decoration.jpg', alt: 'Yellow and white flowers in brass urns and a draped golden arch, set among garden greenery in Udaipur.' },
  'haldi-couple': { author: 'Adityapp123', licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:Haldiii.jpg', alt: 'A smiling couple, she in a yellow sari and he in white, hold hands in golden light as petals fall around them.' },
  'haldi-family': { author: 'AmanAgrahari01', licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'https://commons.wikimedia.org/wiki/File:Indian_Traditional_Wedding_Images_(40).jpg', alt: 'Seen from above, women in bright saris and bangles reach their hands towards a laughing groom in yellow at the centre.' },
  'fort-hilltop': { author: 'Archit Ratan', licence: 'CC BY 2.0', licenceUrl: 'https://creativecommons.org/licenses/by/2.0/', source: 'https://commons.wikimedia.org/wiki/File:Neemrana_fort.jpg', alt: 'A terraced sandstone fort-palace on a hillside in Rajasthan, looking out over green fields under a clear sky.' },
  'fort-hands': { author: 'Pablo Heimplatz', licence: 'CC0 1.0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', source: 'https://commons.wikimedia.org/wiki/File:Indian_Wedding_Couple_(Unsplash).jpg', alt: 'A couple’s hands held together against a gold embroidered lehenga and a beige sherwani.' },
};

const photo = (slug) => ({ slug, src: `/static/img/inspiration/${slug}.jpg`, small: `/static/img/inspiration/${slug}-sm.jpg`, ...PHOTOS[slug] });

const STORIES = [
  {
    slug: 'pink-city-courtyard',
    title: 'A pink-city courtyard, and a vintage arrival',
    place: 'Jaipur, Rajasthan',
    teaser: 'Rose-pink arches, a red open-top car and a family that loves a grand entrance.',
    hero: photo('jaipur-courtyard'),
    detail: photo('jaipur-mehendi'),
    setting: 'Imagine a palace courtyard in the old city, its rose-pink arches glowing in the afternoon, closed to the public for a few golden hours.',
    mood: 'Playful and cinematic. Bright silks against sandstone, music drifting from the arcades, nobody standing still for long.',
    detailText: 'Initials hidden in the mehendi, for the two of you to find in photographs years later.',
    distinctive: 'Arriving in a restored vintage car, with family portraits taken under the arches before the evening begins.',
  },
  {
    slug: 'garden-of-fountains',
    title: 'A garden of fountains by the lakes',
    place: 'Udaipur, Rajasthan',
    teaser: 'Marble pavilions, bougainvillea and an unhurried afternoon by the water.',
    hero: photo('udaipur-garden'),
    detail: photo('udaipur-florals'),
    setting: 'Imagine a heritage garden of fountains and white pavilions, shaded by palms and framed by bougainvillea.',
    mood: 'Calm and luminous. White, gold and green, with long lunches and the sound of water.',
    detailText: 'Florals arranged without foam, so the flowers can be given back as natural colour for a spring celebration.',
    distinctive: 'Shaded seating close to the front for grandparents, and acoustic music by the pool as the light softens.',
  },
  {
    slug: 'sunlit-yellow-morning',
    title: 'A sunlit morning in yellow',
    place: 'At home, or on a garden lawn',
    teaser: 'Golden light, falling petals and the whole family laughing in one place.',
    hero: photo('haldi-couple'),
    detail: photo('haldi-family'),
    setting: 'Imagine an open lawn, or the courtyard of the family home, set for a morning that belongs to the people closest to you.',
    mood: 'Joyful, informal and golden. Everyone in shades of yellow, nobody worried about their clothes.',
    detailText: 'Marigold petals instead of confetti, gathered from the décor and showered at the end.',
    distinctive: 'For families who keep a turmeric ceremony, it becomes the warmest hour of the whole celebration, before the formal days begin.',
  },
  {
    slug: 'hilltop-fort-weekend',
    title: 'An intimate weekend at a hilltop fort',
    place: 'Two hours from Delhi',
    teaser: 'Forty guests under one roof, and long dinners on the ramparts.',
    hero: photo('fort-hilltop'),
    detail: photo('fort-hands'),
    setting: 'Imagine a restored fort-palace on a hillside, its terraces stepping down towards open fields.',
    mood: 'Close-knit and golden-hour slow. Breakfasts that turn into lunches, and evenings that end with stories.',
    detailText: 'A quiet moment for just the two of you, hands held, before the guests arrive.',
    distinctive: 'Every guest stays under the same roof, so the celebration never really pauses for a whole weekend.',
  },
];

const findStory = (slug) => STORIES.find((s) => s.slug === slug) || null;
const CREDITS = Object.keys(PHOTOS).map(photo);

module.exports = { STORIES, findStory, CREDITS };
