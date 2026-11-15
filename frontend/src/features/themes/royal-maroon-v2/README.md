# Royal Maroon v2 — The Maroon Conservatory

Independent available template in Heritage / Ceremonial Classic. Original Royal
Maroon (`traditional`) is unchanged. Shared wedding content, editor, selection
and preview routes are reused; no wedding records or schema were changed.

## Five coordinated ornament variants

| Motif | Placement |
| --- | --- |
| Iris spray | Opening footer, introduction finish, couple finish, events and gallery headings, RSVP finish, closing |
| Oval wreath | Personalized opening/closing monograms and both portrait frames |
| Climbing vine | Opening photograph sides and every story chapter |
| Botanical corner | Opening and section margins, story/gallery photo mats, event card feet, RSVP frame and closing |
| Rosette | Introduction/story headings, section transitions, chapter seals, event details and RSVP heading |

Corner artwork occupies reserved mobile padding. Photo decorations stay at frame
edges. Event card footers reserve enough room to keep artwork away from the map
links. All motifs ignore pointer events and are hidden from assistive technology.
No animation was introduced. The renderer responds to its own container width.

## Artwork and generation

Four transparent WebP assets are original AI-generated art, created using the
built-in image generation tool on 15 November 2026, then resized and encoded for
web delivery. They are bundled locally and reused; no runtime image service or
additional package dependency is required. Source PNGs remain in this chat's
`generated_images` directory. The corner shown in the final theme is the new
transparent floating arrangement, not either discarded corner attempt.

| File | Dimensions | Bytes |
| --- | --- | --- |
| assets/botanical-engraving.webp | 1100 × 367 | 137508 |
| assets/botanical-corner.webp | 450 × 450 | 45478 |
| assets/botanical-vine.webp | 240 × 720 | 63978 |
| assets/botanical-wreath.webp | 600 × 750 | 156610 |
| Total reusable bitmap artwork | | 403574 |

The fifth motif, a small eight-petal rosette, is original inline SVG with no IDs
or external references, allowing repeated ornaments and embedded previews.
The thumbnail is an original SVG composition. The motifs are creative botanical
artwork without a claim to a specific regional tradition.

Generation briefs (built-in tool, transparent background):

- Spray: one symmetrical antique-gold botanical flourish, a central iris-like
  flower, acanthus leaves, buds and seed pearls, fine copperplate-style engraving;
  airy silhouette, no lettering, crowns, background or watermark.
- Wreath: match the spray's fine engraved antique gold, pale highlights and bronze
  veins. One complete 4:5 oval botanical frame, narrow foliage, buds and seed
  pearls, small iris at the bottom, centre fully transparent for a portrait or
  initials. No solid disk, text, background or drop shadow.
- Vine: match the spray's engraving style. One slender vertical climbing acanthus
  branch in a 1:3 composition, alternating curved leaves, two small iris buds and
  seed pearls, growing upward. True alpha transparency, no frame or text.
- Final corner: a single isolated gold botanical L-shaped corner ornament on true
  transparency. Wide transparent padding on all sides, modest iris at the elbow,
  one branch sweeping right and another down, empty lower-right space. Engraved
  acanthus, buds and pearls, crisp edges, no haze, glow, background or text.

## Behavior and validation

Initials derive from the couple's current nicknames/names. Optional story,
gallery, profile images and closing images retain the shared content contract.
Below-cover photos remain lazy-loaded. RSVP uses the existing disabled shared
preview with an explicit bilingual notice; online submission is not implemented.

Ornament refinement validation: 448 focused tests passed, including the full
shared-content contract for all renderable themes and a five-motif/every-section
check. Production build and TypeScript checks passed. Browser review covered all
sections at phone and desktop sizes, with narrow-screen overflow and map/form
clearance checked at 320px. Also corrected a preview-toolbar overflow at 320px and
prevented desktop story photos from expanding beyond their grid columns.

This is local work; no publication or wedding-record selection was performed.
