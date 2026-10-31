# The Royal Knot — UI module

Presentation layer only for the wedding planning management system. Every screen renders from **mock data held in browser memory**. There is no authentication, session, database, API, Google Meet, transcript capture, e-signing, payments or document generation yet. Buttons that would call one of those show a "Preview only" notice.

## Run

```bash
npm install
npm start
```

Open http://localhost:3000. That's the developer preview hub, not a login.

| Route | Interface |
| --- | --- |
| `/couple` | Couple portal (hash sections: `#journey`, `#details`, `#consultation`, `#plan`, `#agreement`, `#vendors`, `#payments`, `#events`) |
| `/agent/weddings` | Agent: wedding cases list |
| `/agent/weddings/:mockKey` | Agent: wedding workspace (`#overview`, `#meeting`, `#documents`, `#agreement`, `#vendors`, `#tasks`, `#schedule`, `#finance`) |
| `/agent/season` | Agent: season overview |

`:mockKey` (for example `sample-a`) is a route key for mock data only. It is **not** a workspace ID.

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
- **Future modules** are marked in the UI with a dashed "Connects later · …" tag. To add a section, add a row to the `SECTIONS` array in the page script and a view function.
- **Progress:** `core/progress.js` defines the milestones. Pages call `publishProgress(p)`, and the garden listens for the `rk:progress` event.

## Couple experience

The couple portal is a guided story told in seven chapters: Your story, Meeting your planner, Your plan in writing, Our agreement, Choosing your vendors, Bringing it together, and The celebration. The home view leads with the current chapter and one primary action, set over the garden, with a reassurance band below (planner note, chapters ahead, what you've shared). All chapters live in the **Your journey** drawer, where upcoming chapters are shown as milestones rather than menu items. Payments and Your details sit "alongside the journey". To add a chapter, add a row to `CHAPTERS` in `public/js/pages/couple.js` and a view function.

## The Shared Garden

- `public/js/garden/garden.js`: the Three.js scene. It is drawn from a single progress value between 0 and 1 and only animates when progress changes; it never replays on load.
- `public/img/garden/*.svg`: the illustrated characters (bride, groom, four guest types). Colours and pose are CSS custom properties on each file's root.
- `public/js/garden/config.js`: palettes, guests, when each guest arrives, and the flower colours. Change art or colours here without touching the scene.
- `public/js/garden/art.js`: the loader, plus the procedural set pieces (arch, lanterns, flower clusters, trees, foliage).

The story, by planning progress:

1. **Dusk:** the couple stand apart with a softly lit path between them.
2. **Planning begins:** the path lights up and flowers appear.
3. **The plan takes shape:** the arch forms, the lanterns and string lights glow, and the couple draw closer.
4. **The wedding approaches:** loved ones arrive one by one.
5. **Plan complete:** the garden is at its most luminous, with the couple hand in hand among their guests.

Other behaviour:

- Wide screens place the couple to the right of the content column, and narrow screens place them in the upper half. The agent workspace shows the same scene in a preview card.
- Artwork loads in two phases (the setting and the couple first) at roughly on-screen resolution.
- `prefers-reduced-motion` gets still frames only.
- Small screens use fewer particles and a lower pixel ratio.
