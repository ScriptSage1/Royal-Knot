// Shared Garden configuration. Swap artwork or palettes here without touching
// the scene code. Each character is an SVG in /static/img/garden/ that exposes
// its colours as CSS custom properties (see the root `style` of each file);
// any key listed in `palette` overrides that property before rasterising.
//
// Indian identity comes from attire, textiles, materials and setting — not
// from religious symbols or ritual objects. A later module can pass
// per-wedding palettes (e.g. the couple's chosen colours) via mountGarden({ config }).

const IMG = '/static/img/garden/';

export const DEFAULT_CONFIG = {
  couple: {
    bride: { src: IMG + 'bride.svg', palette: {} },
    groom: { src: IMG + 'groom.svg', palette: {} },
  },

  // Loved ones join as the wedding approaches. `at` is the planning progress
  // (0…1) at which each guest arrives; `x` is an offset from the couple in
  // units of the couple's spacing (negative = bride's side); `row` sets depth.
  guests: [
    { type: 'elder', x: -1.55, row: 'side', at: 0.70, palette: {} },
    { type: 'sari', x: 1.55, row: 'side', at: 0.72, palette: { '--sari': '#26335C', '--sari-mid': '#34457A', '--sari-shade': '#1A2442', '--blouse': '#D9B26A', '--skin': '#D2A07E', '--skin-shade': '#B07E5E' } },
    { type: 'bandhgala', x: -1.05, row: 'back', at: 0.76, palette: { '--coat': '#2E5E4E', '--coat-mid': '#3D7562', '--coat-shade': '#1F4639', '--skin': '#B98263', '--skin-shade': '#946045' } },
    { type: 'child', x: 1.0, row: 'front', at: 0.80, palette: {} },
    { type: 'sari', x: 1.25, row: 'back', at: 0.84, palette: { '--sari': '#EDE1C8', '--sari-mid': '#F7EEDC', '--sari-shade': '#CDB990', '--blouse': '#A9304C', '--skin': '#8C5A3F', '--skin-shade': '#6F4430' } },
    { type: 'bandhgala', x: -1.8, row: 'back', at: 0.88, palette: { '--coat': '#EDE1C8', '--coat-mid': '#F7EEDC', '--coat-shade': '#CDB990', '--trousers': '#26335C', '--trousers-shade': '#1A2442', '--pocket': '#2E5E4E', '--skin': '#D7A584', '--skin-shade': '#B38262' } },
    { type: 'elder', x: 1.85, row: 'back', at: 0.92, palette: { '--jacket': '#26335C', '--jacket-shade': '#1A2442', '--shawl': '#EDE1C8', '--shawl-shade': '#CDB990', '--skin': '#C99A78', '--skin-shade': '#A77A5A' } },
    { type: 'child', x: -1.0, row: 'front', at: 0.95, palette: { '--outfit': '#A9304C', '--outfit-mid': '#C24862', '--outfit-shade': '#7A1E36', '--choli': '#D9B26A', '--skin': '#8C5A3F', '--skin-shade': '#6F4430', '--bloom': '#FFF4E0' } },
  ],

  guestArt: {
    sari: { src: IMG + 'guest-sari.svg', height: 0.86 },
    bandhgala: { src: IMG + 'guest-bandhgala.svg', height: 0.88 },
    child: { src: IMG + 'guest-child.svg', height: 0.52 },
    elder: { src: IMG + 'guest-elder.svg', height: 0.8 },
  },

  // Planters: bougainvillea, jasmine and marigold
  planters: ['bougainvillea', 'jasmine', 'marigold'],
};
