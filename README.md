# Anjia Property — website redesign proposal

An independent redesign proposal for the Thai property site **anjia-home.net**, built from
that site's own content: 67 listings, 787 photographs, and its own brand colours.

**This is not the official Anjia Property website.** It is an unaffiliated proposal. Every
page says so, and the whole site is `noindex` with a blocking `robots.txt`.

| | |
|---|---|
| `index.html` | The proposal — homepage |
| `residences.html` | The collection: all 67 residences, filtered by tenure first |
| `residence.html?id=…` | A residence in detail |
| `ownership.html` | What a foreigner may lawfully own in Thailand |
| `contact.html` | Private consultation |
| `compare.html` | The live site beside the proposal, at ten screen sizes |
| `redesign-proposal.pdf` | The client-facing pitch (1.1 MB) |
| `audit-report.pdf` | The underlying technical audit |

## What was kept

Anjia's own orange (`#ff9418`) and slate (`#0f172a`), their four languages, and every
property, price, developer profile, testimonial and photograph — all taken from their
live site. The neutrals were warmed so the palette reads warm rather than clinical.

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

Static HTML and CSS with a little vanilla JavaScript. No framework, no build step.
Verified across ten widths from 320 px to 1920 px: zero horizontal overflow, zero native
`<select>` elements, all touch targets at least 44 px.
