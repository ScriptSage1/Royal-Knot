// Shared Garden configuration. Swap artwork or palettes here without touching
// the scene code. Each character is an SVG in /static/img/garden/ that exposes
// its colours as CSS custom properties (see the root `style` of each file);
// any key listed in `palette` overrides that property before rasterising.
//
// The scene is deliberately culture-independent: formal attire, no ritual
// props or religious symbols. A later module can pass per-wedding palettes
// (e.g. attire colours the couple shares) through mountGarden({ config }).

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
    { type: 'suit',  x:  1.55, row: 'side', at: 0.72, palette: { '--outfit': '#5B4A7A', '--outfit-mid': '#715E95', '--outfit-shade': '#41355A', '--skin': '#D7A584', '--skin-shade': '#B38262', '--hair': '#3B2A22' } },
    { type: 'gown',  x: -1.05, row: 'back', at: 0.76, palette: { '--outfit': '#2F6B6B', '--outfit-mid': '#3E8585', '--outfit-shade': '#215050', '--skin': '#8E5E43', '--skin-shade': '#6E4530', '--hair': '#1A1210' } },
    { type: 'child', x:  1.0,  row: 'front', at: 0.80, palette: {} },
    { type: 'gown',  x:  1.25, row: 'back', at: 0.84, palette: { '--outfit': '#B0595E', '--outfit-mid': '#C46E72', '--outfit-shade': '#8A4045', '--skin': '#E2B898', '--skin-shade': '#C09372', '--hair': '#6A4532' } },
    { type: 'suit',  x: -1.8,  row: 'back', at: 0.88, palette: { '--outfit': '#3F4A63', '--outfit-mid': '#55617E', '--outfit-shade': '#2C3447', '--skin': '#B98263', '--skin-shade': '#946045', '--hair': '#2A2A2A' } },
    { type: 'elder', x:  1.85, row: 'back', at: 0.92, palette: { '--outfit': '#6A4E3A', '--outfit-mid': '#836350', '--outfit-shade': '#4E392A', '--shawl': '#D9C4D9', '--shawl-shade': '#B9A0B9', '--skin': '#E6C1A4', '--skin-shade': '#C49E80' } },
    { type: 'child', x: -1.0,  row: 'front', at: 0.95, palette: { '--outfit': '#8DB3A2', '--outfit-mid': '#A6C7B8', '--outfit-shade': '#6C9282', '--skin': '#7A4E36', '--skin-shade': '#5E3A27', '--hair': '#15100E', '--bloom': '#F7D27A' } },
  ],

  guestArt: {
    gown: { src: IMG + 'guest-gown.svg', height: 0.86 },
    suit: { src: IMG + 'guest-suit.svg', height: 0.88 },
    child: { src: IMG + 'guest-child.svg', height: 0.52 },
    elder: { src: IMG + 'guest-elder.svg', height: 0.78 },
  },

  flowers: ['#F2B6AE', '#FFF4E6', '#F4CB8E', '#D9B8E8', '#F7C9D6', '#E9A07E'],
};
