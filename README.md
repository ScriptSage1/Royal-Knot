# The Royal Knot — UI module

Presentation layer only for the wedding planning management system. Every screen renders from **mock data held in browser memory**. There is no authentication, persistent session storage, database, API, Google Meet, transcript capture, e-signing, payments or document generation yet. Buttons that would call one of those show a "Preview only" notice.

## Run

```bash
npm install
npm start
```

Open http://localhost:3000. That's the developer preview hub, not a login.

| Route | Interface |
| --- | --- |
| `/couple` | Couple portal (chapters by hash: `#details`, `#consultation`, `#plan`, `#vendors`, `#agreement`, `#events`, `#day`, plus `#payments`) |
| `/agent/weddings` | Agent: wedding cases list |
| `/agent/weddings/:mockKey` | Agent: wedding workspace (`#overview`, `#meeting`, `#documents`, `#vendors`, `#agreement`, `#tasks`, `#schedule`, `#finance`) |
| `/agent/season` | Agent: season overview |

`:mockKey` (`sample-a` or `sample-b`) selects a preview wedding record. It is **not** a persistent workspace ID.

### Previewing planning stages

Add `?stage=0` … `?stage=9` to the couple portal or a wedding workspace to show a planning stage. The stage drives the couple's chapters, what is unlocked, and the garden.

Developer controls are hidden during a normal presentation. Add `?dev=1` to show the **Dev preview** pill (bottom-left), which switches interfaces and changes stage live; this is remembered for the browser tab. Turn it off with `?dev=0`. It is not authentication.

## Structure

```
server.js                 Express + EJS; serves views and static files only
views/                    EJS shells (partials: head, garden, devbar, agent sidebar)
public/css/               base.css (tokens + components), couple.css, agent.css
public/js/core/           ui.js (escaping html``, pills, toasts), progress.js (milestones/stages), devbar.js
public/js/data/           source.js  ← integration boundary
                          agency-mock.js (internal), couple-mock.js (couple-safe projection)
public/js/components/     journey, workspace, meeting, documents, agreement, payments, proposals, tasks, schedule
public/js/pages/          couple.js, agent-cases.js, agent-workspace.js, agent-season.js
public/js/garden/         garden.js — Three.js "Shared Garden" background
```

## Integration points

- **Data:** replace the bodies of the functions in `public/js/data/source.js` with API calls. Components only receive plain objects and arrays.
- **Couple privacy:** the couple portal only imports `couple-mock.js`. Agent notes, transcripts, internal vendor comments and arrival tracking aren't in that file. The real API should apply the same projection on the server.
- **Future modules** are marked in the UI with a dashed "Planned · …" tag. To add a section, add a row to the `SECTIONS` array in the page script and a view function.
- **Progress:** `core/progress.js` defines the milestones. Pages call `publishProgress(p)`, and the garden listens for the `rk:progress` event.

## Couple experience

The portal is one journey in eight chapters:

1. Your story
2. Meeting your planner
3. Your plan, in writing
4. Choosing your vendors
5. Our agreement
6. Bringing it together
7. The wedding day
8. After the celebration

There is one way to navigate and see progress: the **Your journey** button in the top bar. It opens a drawer listing every chapter, with completed chapters you can revisit and upcoming ones marked as milestones. Payments and what you've shared are always available there.

The home view shows one moment at a time:

- the chapter
- a short line about what your planner is handling
- one primary action
- what happens next, with supporting detail behind an expander

Chapter content opens as an ivory panel over the garden. To extend the journey, add a row to `CHAPTERS` in `public/js/pages/couple.js` and a view function.

The first chapter asks only optional questions. Traditions are a single open question: "Are there any traditions, customs, or family practices you'd like us to make room for?" Couples can also answer "We're still deciding" or ask to talk it through with their planner.

## Planner workspace

- **`/agent/weddings`:** two sample wedding records, each with its own route key and workspace. Their dates, planners, plans, notes and workflow stages differ; changes are preview-only and are not stored in a database.
- **`/agent/weddings/:mockKey`:** the selected wedding case file. Its overview shows up to three priority actions and a compact couple summary. Meeting notes, requirements, vendor proposals, agreement, tasks, schedule, and payments stay in their own sections.
- **`/agent/season`:** a compact view of both sample workspaces. Portfolio metrics remain hidden because these are demo records.
- **Mobile:** the sidebar becomes a slide-in menu, and workspace sections are also available from a section picker.

Mock data uses a fixed reference date, `AS_OF` (31 Oct 2026, in `public/js/data/agency-mock.js`), so deadlines read the same on any day.
## The Shared Garden

- `public/js/garden/garden.js`: the Three.js scene. It is drawn from one progress value between 0 and 1 and only animates when progress changes; it never replays on load.
- `public/img/garden/*.svg`: the illustrated characters.
  - The bride wears a lehenga with a zari border and a dupatta, with a jasmine gajra and jhumkas.
  - The groom wears an ivory sherwani with a rose stole and mojaris.
  - There are four guest types: a sari, a bandhgala, a child in a lehenga, and an elder in a kurta, Nehru jacket and shawl.
  - Colours and pose are CSS custom properties on each file's root.
- `public/js/garden/config.js`: palettes, guests, when each guest arrives, and the planter types.
- `public/js/garden/art.js`: the loader, plus the courtyard set pieces. These are a carved sandstone wall with cusped jaali arches (with a separate glow layer), a chhatri-inspired pavilion with jasmine and marigold strands, a block-print runner, brass lanterns, bougainvillea, champa trees and planters.

Indian identity comes from attire, textiles, architecture, plants and brass light. There are no religious symbols or ritual objects, and there is a single story for every couple.

The story, by planning progress:

1. **Dusk:** the couple stand apart with the runner softly lit between them.
2. **Planning begins:** the runner lights up and bougainvillea and planters bloom.
3. **The plan takes shape:** the pavilion forms, the jaali screens and lanterns glow, and the couple draw closer.
4. **The wedding approaches:** loved ones arrive one by one.
5. **Plan complete:** the courtyard is at its most luminous, with the couple hand in hand among their guests and petals falling.

Other behaviour:

- Wide screens keep the couple and bright details out of the text column. Narrow screens place the scene in the upper half.
- `prefers-reduced-motion` gets still frames.
- Artwork loads in two phases at roughly on-screen resolution, and small screens use fewer particles.
