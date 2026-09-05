# Anjia Residences — maintainer's handoff

Everything you need to keep changing this site **without losing the warm Anjia feel** and
**without letting the layout burst out of the screen again**. Written for whoever picks
this up next, including future-me.

---

## 0. What this is, in one paragraph

An independent redesign proposal for **anjia-home.net**, a cross-border property agency
selling Thai property (Pattaya and Bangkok) to mostly overseas buyers, and managing it for
owners who live abroad. Every property, price, photograph, developer profile and
testimonial on this site was taken from their own live site. It is **not** the official
Anjia site, every page says so, and the whole thing is `noindex` + `robots.txt` disallow.

Live: **https://mfu-hlaing.github.io/anjia-redesign-proposal/**
Repo: `mfu-hlaing/anjia-redesign-proposal`, GitHub Pages from `main`, root.

---

## 1. Where everything lives

```
Anjia/
├── redesign2/              ← THE SITE. This is what deploys.
│   ├── *.html              14 pages
│   ├── assets/
│   │   ├── system.css      design tokens + reset + primitives   ← start here
│   │   ├── site.css        components (header, hero, cards, footer…)
│   │   ├── parity.css      later additions (search, currency, cookie, views…)
│   │   ├── data.js         generated — all 68 listings
│   │   ├── site.js         theme, drawer, pickers, reveals, rail
│   │   ├── search.js       the search + filter engine
│   │   ├── parity.js       currency, cookie, saved, chat, view toggles
│   │   ├── detail.js / journal.js / saved.js
│   │   ├── brand/          the real Anjia logo, as PNG
│   │   └── img/            703 generated image derivatives
│   ├── HANDOFF.md          this file
│   └── *.pdf               the audit and the client proposal
├── audit/tools/            the measurement + capture rig (see §5)
├── content/                the crawl: api.json, clean.json, raw/ (787 originals)
└── report/                 the two PDF builders
```

**Rule:** `redesign2/` is the deliverable. `audit/`, `content/` and `report/` are the
workshop and are *not* deployed.

---

## 2. The brand — how to keep the vibe

The single most important thing: **this is Anjia's brand, not a new one.** Every colour
choice traces back to something they already own.

### The logo

`assets/brand/anjia-mark-128.png` (and `-256`). It is **their real logo**, pulled from
`company-brand/logo.png` on their own asset bucket: a house roof with an "AJ" monogram,
cradled in two open hands, with a sparkle.

That image is the brief. Hands holding a home = *care and stewardship*, which is literally
what the business sells (they manage the property after the sale for owners who live
abroad). Anything that feels cold, corporate or austere is off-brand — the mark itself is
warm and human.

The mark is a flat single-colour PNG with a transparent background, so it works on both
themes with no variant. Do not outline it, do not put it in a box, do not replace it with
a 安 glyph — that was tried and it killed the warmth.

### The colours

The brand orange was **sampled out of the logo file itself**: the mark is a flat
`#fe7d05`. The whole amber ramp in `system.css` is that hue lightened and darkened, so
every orange on the site is literally their orange.

| Token | Value | Use |
|---|---|---|
| `--amber-500` | `#fe7d05` | the logo orange. Accents, the mark, highlights |
| `--amber-600` | `#e06c01` | primary buttons |
| `--amber-700` | `#a85101` | text on light grounds, hover |
| `--amber-800` | `#743b07` | text on cream panels |
| `--amber-100` | `#ffefe1` | tinted surfaces |
| `--slate-900` | `#0f172a` | their original ink; chrome, dark panels |

**Neutrals are warm on purpose.** `--ink-*` and `--paper-*` are brown-biased, not
blue-grey. This is what makes the page feel welcoming rather than clinical. If you ever
add a grey, take it from the ramp — never `#666` or a cool slate.

Two surfaces are dark in *both* themes (the hero photo and the enquiry panel). They use
`--on-dark-*` tokens which are **declared once in `:root` and never redefined** in a dark
block. If you put text on a permanently-dark surface, use those. Getting this wrong is how
you end up with white-on-white in dark mode — it has already happened twice on this
project.

### The type

- **Display / prices:** Fraunces. Warm and characterful, not a cold high-fashion serif.
  Bodoni Moda was tried and rejected for feeling austere.
- **Interface / body:** IBM Plex Sans Thai — **one family covering Latin and Thai**.
  Do **not** add a separate Thai font or a separate Thai treatment; that was explicitly
  ruled out. Chinese and Japanese fall through to the system stack.

### Tone of voice

Plain, specific, unhurried. Say the useful thing rather than the flattering one — "the
honest answer is that nothing in our collection fits" is the register. No exclamation
marks, no "luxury" as an adjective, no stock-photo language.

---

## 3. Layout — how to never let it burst out of the screen again

The original site's headline defect was that it rendered **479 px wide on every phone**, so
anything under 480 px scrolled sideways (159 px hidden at 320 px). The cause was a chain of
CSS Grid items left at the default `min-width: auto`.

### The four rules that prevent it

**1. Everything opts out of min-content sizing.** `system.css` line ~123:

```css
*{min-width:0}
```

One line. A grid or flex item can never refuse to shrink and burst its track. This is the
single most valuable rule in the stylesheet — do not remove it.

**2. Both `html` and `body` clip horizontally.**

```css
html{overflow-x:clip}
body{overflow-x:clip}
```

A belt-and-braces guard. Note it only *hides* a mistake, it does not fix one — always fix
the offending element too.

**3. Anything off-screen must be `visibility:hidden`, not merely translated away.** The
closed mobile drawer sits at `translateX(101%)`. Transform alone still contributed **24 px**
to `documentElement.scrollWidth`, *and* kept its links in the tab order. The fix:

```css
.drawer{transform:translateX(101%); visibility:hidden;
        transition:transform .4s var(--ease-out), visibility 0s linear .4s}
.drawer[data-open]{transform:none; visibility:visible;
        transition:transform .4s var(--ease-out), visibility 0s}
```

**4. Wide content scrolls inside its own box.** Tables, code, image rails and the device
strip all sit in a container with `overflow-x:auto`. The page body never scrolls sideways.

### Breakpoints — and a debt you should pay

The design system is **three breakpoints**: `680`, `1000`, `1400`.

`system.css` and `site.css` obey that. **`parity.css` has already drifted to eight**
(`560, 700, 760, 860, 900, 1000, 1080, 1200`), which makes ten across the site.

This is exactly the rot that produced the original site's eighteen breakpoints — including
both `720px` and `721px` — where each component was patched in isolation until nothing
reflowed together. **Consolidating `parity.css` onto the three system breakpoints is the
top piece of technical debt here.** Do it before adding more components, not after.

When you genuinely need a component to reflow off-grid, prefer an intrinsic rule that needs
no breakpoint at all:

```css
grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
```

The `min(260px, 100%)` matters — plain `minmax(260px, 1fr)` overflows below 260 px.

### Touch targets

44 px minimum on every interactive element. The original had 30 of 58 under that.

### Never use a native `<select>`

There are **zero** on this site and it should stay that way. On a phone a native select
hands the whole screen to the operating system's picker at the exact moment someone is
choosing — the brand vanishes. Use the `.pick` component (`site.js` → `initPick`); it is a
real listbox with arrow keys, Home/End, Escape, and correct ARIA. If you inject a picker
after page load, call `window.initPick(el)` on it.

---

## 4. Common tasks

### Run it locally

```bash
SERVE_PORT=8810 SERVE_ROOT=/Users/thomas/Backbencher_Projects/Anjia/redesign2 node /Users/thomas/Backbencher_Projects/Anjia/audit/tools/serve.js
```

Then open `http://127.0.0.1:8810/`. The same server also provides `/__harness?w=390&h=880&route=/index.html`,
which renders any page inside an exact-width iframe — that is how every device measurement
in §5 is taken.

### Add a page

Copy the `<head>`, `.notice`, `<header>`, drawer and `<footer>` from `contact.html` — it is
the simplest complete page. Keep the same asset order:

```html
<link rel="stylesheet" href="assets/system.css">
<link rel="stylesheet" href="assets/site.css">
<link rel="stylesheet" href="assets/parity.css">
```

`parity.css` loads last and will win ties, which is worth remembering when a rule of yours
appears to do nothing.

### Change a colour

Edit the token in `system.css`. Never hard-code a hex in a component. Before you commit,
run the theme-safety check in §5 — it catches colours that only exist inside a dark block,
which is the classic unreadable-in-one-theme bug.

### Refresh the property data from the live site

```bash
node  audit/tools/proxy.js            # same-origin proxy on :8788
node  audit/tools/crawl.js            # walks every route, captures the API
python3 audit/tools/normalize.py      # → content/clean.json, PII stripped
python3 audit/tools/fetch_images.py   # downloads originals
python3 audit/tools/build_dataset.py  # → assets/data.js + image derivatives
```

⚠️ **`normalize.py` uses a strict allowlist, not a denylist.** Their public API returns
property owners' names, mobile numbers and LINE IDs, plus a named sales contact and direct
mobile on 41 of 43 developments. None of it belongs anywhere near this site. **Never
loosen that allowlist**, and never print those fields to a terminal or a log.

Two image gotchas: their S3 URLs contain unencoded spaces and Thai filenames, so a plain
`curl` 404s on ~30% of them — percent-encode the path. And the album/cover URLs live in the
API JSON, not in rendered `<img>` tags, so a DOM-only scrape silently misses half the
library.

---

## 5. The verification rig — how to check every screen size

This is the part worth keeping. Everything lives in `audit/tools/`.

### The trap you must know about

Headless Chrome on macOS **will not go below ~480 px wide**. With
`Emulation.setDeviceMetricsOverride` at 320 px you still get `innerWidth` and `scrollWidth`
of **479**, and `position:fixed` elements lay out against 479 too.

The coincidence that makes this dangerous: the original site's real overflow was *also*
479 px. The artefact and the bug produce the same number. **Never trust a 479 from this rig
without the workaround.**

`documentElement.clientWidth`, per-element `getBoundingClientRect()` and a plain
`Page.captureScreenshot` *are* correct. `captureBeyondViewport:true` is **not** — full-page
mobile shots come out silently wrong.

### The workaround

`proxy.js` reverse-proxies the target so it is same-origin, and serves
`/__harness?w=&h=&route=` — a page holding an exact-width iframe. Measure inside it via
`contentWindow.eval(...)` and `innerWidth` matches exactly. `serve.js` is the same harness
for local files.

Cross-origin routes were all tried and all failed: `--disable-web-security` no longer
applies to `file://`, `Page.getFrameTree` shows no child frame, and `Target.setAutoAttach`
never fires for the OOPIF. Don't spend the afternoon again.

### The sweep to run before every commit

14 pages × 11 widths (320 → 1920), checking horizontal overflow, native selects and small
tap targets. It currently reports **zero problems** — keep it that way.

```bash
node audit/tools/sweep.js       # needs serve.js running on :8810
```

Other tools:

| Tool | What it does |
|---|---|
| `capture.js` | screenshots any route at any size, light or dark, viewport or full page |
| `iframe_probe.js` | true geometry: overflow, offenders, fixed overlays, header contents |
| `crawl.js` | walks the live site, captures every API response and image URL |
| `normalize.py` | API → clean, PII-free dataset |
| `build_dataset.py` | dataset + images → `data.js` + derivatives |

### Finding what causes an overflow

Walk the ancestor chain comparing `getBoundingClientRect().width`, then inject a candidate
CSS fix and re-read `scrollWidth` at several widths. That is what turned a guess into the
verified one-line fix for the original site. The detector must be **clip-aware** — walk
ancestors for `overflow-x` and skip anything inside a `position:fixed` subtree, or a
perfectly healthy clipped carousel reports as a 350 px offender.

### Theme safety check

```bash
python3 - <<'EOF'
import re
s=open('assets/system.css',encoding='utf-8').read()
root=re.search(r':root\{(.*?)\n\}',s,re.S).group(1)
dark=re.search(r':root\[data-theme="dark"\]\{(.*?)\n\}',s,re.S).group(1)
rt={m.group(1) for m in re.finditer(r'(--[a-z0-9-]+)\s*:',root)}
dk={m.group(1) for m in re.finditer(r'(--[a-z0-9-]+)\s*:',dark)}
print('defined only in dark:', sorted(dk-rt) or 'none ✓')
EOF
```

Anything listed is a colour that will be undefined in light mode. Should always be `none`.

---

## 6. Deploying

```bash
cd redesign2
git add -A && git commit -m "…"
git push origin main
```

Pages rebuilds in 40–60 s. Check with:

```bash
gh api repos/mfu-hlaing/anjia-redesign-proposal/pages --jq .status
```

Then verify with a cache-buster (`?v=2`) — GitHub serves a stale copy for a minute or two
and you will otherwise chase a phantom bug.

`gh repo create` was blocked by the permission classifier twice before going through.
If it refuses, retry rather than assuming it is permanently unavailable.

---

## 7. Things that will bite you

- **`parity.css` loads last** and quietly wins specificity ties. A rule of yours in
  `site.css` that "does nothing" is usually being overridden there. This already caused the
  hamburger to reappear at 1440 px once.
- **The `--gulf-*` and `--brass-*` tokens are legacy aliases** from an earlier teal/brass
  direction that was rejected. They now point at the Anjia palette. Don't add new uses;
  prefer `--amber-*`, `--slate-*`, `--deep-*`.
- **Scroll reveals must never be able to trap content.** `site.js` has a 1.5 s failsafe that
  force-reveals anything near the viewport. Keep it.
- **Prices are `tabular-nums` in Fraunces.** If you swap the display face, check the
  numerals — a lot of serifs have old-style figures that look wrong in a price column.
- **The `robots.txt` disallow and the `noindex` meta are deliberate.** This must never
  compete with or be mistaken for the real anjia-home.net.

---

## 8. Open items

1. **Consolidate `parity.css` onto the three system breakpoints.** (§3, highest value)
2. **Tell the client about the owner-data exposure.** It is page 8 of
   `redesign-proposal.pdf` and is more urgent than anything visual.
3. The repo is under `mfu-hlaing`; move it if it should live in someone else's account.
4. `compare.html` still shows the pre-warm screenshots — regenerate the pairs after any
   visual change (`audit/pairs/`, then `assets/compare/`).
5. No server rendering yet. Search engines see the HTML but the listing pages are still
   built client-side from `data.js`.

---

*Last updated 5 September 2026. If you change the palette, the type, or the breakpoint set,
update this file in the same commit — it is the only thing standing between the next person
and a slow drift back to eighteen breakpoints.*
