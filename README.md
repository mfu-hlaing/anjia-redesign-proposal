# Anjia Property — website redesign proposal

An independent redesign proposal for the Thai property site **anjia-home.net**, rebuilt
from a complete privacy-safe crawl of that site's public content: **167 listings**
(43 developments, 123 resale residences and one land parcel), four articles, eleven
verified owner stories, eight advisers, 105 unit layouts and 3,586 retained remote media
assets. It keeps Anjia's real logo and brand colours.

**This is not the official Anjia Property website.** It is an unaffiliated proposal. Every
page says so, and the whole site is `noindex` with a blocking `robots.txt`.

## Feature parity, then improvement

Every control on the live site was inventoried from its own markup — not from screenshots —
page by page, and matched here before anything new was added. The parity matrix lives in
`audit/parity/matrix.json`; the script that computes it is `build/parity_matrix.py`.

| Page | Mirrors |
|---|---|
| `index.html` | `/` — hero search: keyword, Buy/Rent/Management, kind, budget, bedrooms, stage, sort, grid/list/map |
| `residences.html` | `/houses` — the whole collection, tenure first |
| `projects.html` | `/projects` — 43 developments |
| `houses.html` | `/thailand` — 123 resale residences |
| `lands.html` | `/lands` — land, and the ownership route it actually requires |
| `about.html` | `/about` — three advantages, eight advisers |
| `process.html` | `/process` — six steps, and the costs stated |
| `journal.html` + `journal/<id>.html` | `/news` — keyword search, category tabs, 4 articles |
| `contact.html` | `/contact` — the full nine-field enquiry |
| `ownership.html` | *(new)* what a foreigner may lawfully own |
| `saved.html` | *(new)* residences kept on the device |
| `privacy.html`, `terms.html` | `/privacy`, `/terms` |
| `residence/<id>.html` | `/house/<id>`, `/project/<id>`, `/land/<id>` — **167 pre-rendered pages** |
| `explore.html` | *(new)* the coast in three dimensions — every residence where its coordinates put it |
| `compare.html` | The live site beside the proposal, at ten screen sizes |

## What the redesign adds

- **A search that searches.** An index over every field held — name, area, address, kind,
  developer, tenure, facilities, what is nearby — with typeahead, and all state in the URL.
- **Tenure as the first filter.** Their data records the foreign-quota position per unit.
  It is the question a foreign buyer asks first, so it is the first control.
- **A concierge that does not improvise.** Answers assembled from Anjia's own published
  guidance and from the collection itself; hands over to a person when judgement is needed.
- **Intent-aware discovery.** Buy keeps the complete source catalogue, Rent uses the eight
  currently advertised rental records and monthly pricing, and Management leads to its
  own adviser-led service rather than recycling sale results.
- **Saved residences** and a **currency switcher that actually converts**, labelled as
  indicative with baht as the contract currency.
- **A map** plotted from each property's own coordinates, with a scale bar and a north
  arrow and no basemap — so nothing is implied that was not measured.
- **Complete project context:** 105 unit types across 39 developments, with their original
  layout drawings, plus all usable project, resale and land gallery photographs.
- **Warmth grounded in real people:** the original group photograph, all eight adviser
  portraits and all eleven correctly attributed owner stories.
- **Immersive but accessible motion:** staggered spring reveals, warm hero drift, tactile
  cards and controls, smooth rails and cross-page transitions, all disabled under
  `prefers-reduced-motion`.
- **167 pages a search engine can read**, each with its own title and full public detail copy.
- **A preview card on every link.** Paste any page into Messenger, WhatsApp, Telegram, LINE,
  iMessage or X and the thumbnail attaches: full Open Graph and Twitter-card tags with a
  generated 1200×630 card per page — each residence with its own photograph, area, tenure and
  price.
- **The coast in three dimensions.** Every residence with coordinates stands on a 3D Pattaya
  coast as a building whose height follows its floor count; amber roofs mark a foreign-ownership
  route, a resale's own floor is lit, and the light is Pattaya's clock unless you choose dawn,
  day, golden hour or night. Filters, areas, a guided tour, and the same URL state as the
  collection. The shoreline is drawn for orientation and says so; records whose coordinates
  cannot be right are listed rather than placed.
- **A room tour.** On every residence page and from the coast: the listing's own photographs
  hung along a warm hall you walk down — swipe, scroll, keys, or let it play — the layout
  drawings at the end, then the door. Fitted to any screen, phone to laptop; on a phone you can
  look around by moving it. No invented geometry — the photographs, at their true aspect.
- **A gallery that behaves on a phone.** Arrows, a counter, swipe, keyboard, crossfade, and a
  lightbox that fits the window at every size.
- **Depth everywhere.** Cards lean toward the pointer with a warm sheen and show their second
  photograph, every page head carries ambient light and sun dust, dark ground lights up under
  the pointer, the enquiry photograph moves with the scroll, and saving a residence celebrates.
  All of it steps aside under `prefers-reduced-motion`.

## The headline finding

The live site renders **479 px wide on every phone**, so any screen under 480 px scrolls
sideways — 159 px hidden at 320 px, 119 px at 360 px, 89 px at 390 px. The cause is a chain
of CSS Grid items left at the default `min-width: auto`. Verified fix:

```css
.insights__panel, .insights__articles, .insightArticle,
.insightArticle__heading, .insightArticle article { min-width: 0 }
```

## A privacy note

The live site's public API returns property owners' names, mobile numbers and LINE IDs for
every resale listing, plus a named sales contact and direct mobile for 41 of 43 developments.
None of it appears on their website; all of it is retrievable without authentication. Every
one of those fields was excluded at source when building this proposal, and none is
reproduced here. It is raised in the audit as the most urgent item.

## Build

Static HTML and CSS with vanilla JavaScript. No framework, no build step for the browser.
The 3D layer uses three.js (r186, MIT), self-hosted in `assets/vendor/` and loaded only on the
coast page and when a walk-through is opened.
Pages are generated by `build/` (`chrome.py` holds the shared page furniture; `gen*.py`
write the pages; `apply_chrome.py` re-syncs the furniture into hand-written pages).

Verified across eleven widths from 320 px to 1920 px, including the 1038 px regression
reported in the brief: zero horizontal overflow and no colliding header controls. Browser
checks cover Buy/Rent/Management, paging, map/list state, honest language handling,
currency formatting, the demonstration form and single-result land pagination.
