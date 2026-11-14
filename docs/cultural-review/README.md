# Cultural review — Traditional regional collections

Internal process for the 12 regional collections in the **Traditional** family
(Javanese, Sundanese, Minangkabau, Batak, Bugis, Betawi, Malay, Madura, Balinese,
Dayak, Ambon / Maluku, Papuan). The culturally neutral **Nusantara Heritage**
collection is separate and does not go through this process.

**Source of truth:** `frontend/src/features/themes/catalog/regional-briefs.ts`.
Status, sources and review notes live there, not in this document.

## Current state

All 12 collections are **In development**:

- no source has been verified by the team;
- no practitioner, community member or cultural organisation has reviewed any brief;
- no regional template exists; `confirmed` references are empty everywhere.

In the studio, regional collections show their brief and preview a **Nusantara
Heritage** template labelled "a culturally neutral design, not a [collection] design".

### Desk review (2026-11-14) — not a practitioner review

An AI cultural-intelligence assistant reviewed the briefs and checked the source links. Changes made:
scope/terminology corrections (e.g. Batak textile names differ by people and some communities do not
identify as Batak; Maluku covers two provinces; Papua is six provinces since 2022), fuller and
explicitly non-exhaustive locality options (with provinces where relevant), new guardrails (e.g. poleng
in Bali; hornbill and mandau/headhunting imagery for Dayak; koteka, bird-of-paradise feathers and
political symbols for Papua; marawa for Minangkabau; Lampung siger for Sundanese), and removal of
wording that implied colour claims or stereotypes (e.g. "Soga-inspired", "bold/high-contrast" for Madura).
This does **not** replace verification or community review; `review.reviewers` stays empty.

### Source link check (2026-11-14)

| Source | Result |
|---|---|
| UNESCO — Indonesian Batik | Loads; title and scope accurate (Indonesia-wide, no single community) |
| Garuda — Pandai Sikek songket (Yandri, *Humanus* 2014) | Old host gone; loads at `garuda.kemdiktisaintek.go.id/documents/detail/1375494`; covers wedding use in Pandai Sikek |
| Garuda — Bugis weavers, Wajo (Kesuma, *Walasuji* 2018) | Old host gone; loads at `…/documents/detail/1151910`; no wedding/sabbe-design content in abstract |
| Budaya Kita portal and records (Ulos Batak Toba, Roti Buaya, Tenun Siak) | Failing (expired TLS certificate); records may now be on DAPOBUD (Kementerian Kebudayaan) — re-locate |
| BPNB Kalbar — Benang Bintik PDF | Host no longer resolves; office now BPK Wilayah XII — find a current copy; Ngaju association unconfirmed |

No source is marked `verified` yet: a link loading is not the same as the team confirming it supports a
specific design reference.

## What a brief separates

| Part | Meaning | Shown to customers as |
|---|---|---|
| `sources` (`verified`) | References and what they actually cover (scope, community, locality) | "Sources · N of M verified" |
| `confirmed` | Garments, textiles, motifs, objects backed by a verified source | "Confirmed cultural references" (none yet) |
| `toResearch` | Candidate references from the product design brief — open questions | "Researching · not confirmed" |
| `avoid` | Guardrails (sacred/restricted imagery, generalisation, caricature) | Internal |
| `artDirection` | Palette, type, composition, imagery, layout — creative choices | "Draft art direction · creative choices, not cultural claims" |

Never move an item from `toResearch` to `confirmed`, or describe a colour, motif,
textile, object or ceremony as meaningful, without a verified source that says so.

## Statuses

| `review.status` | Meaning |
|---|---|
| `in_development` | References incomplete; locality may not be chosen |
| `awaiting_review` | Locality chosen, sources verified by the team, draft design ready for community review |
| `reviewed` | Reviewed by named practitioners/organisations; feedback addressed |

## Steps to make a collection available

1. **Choose the locality or subtradition** (`selectedLocality`) — required for multi-community
   collections. A brief may cover several localities only as separate templates.
2. **Verify sources.** Read each source; correct `covers` to what it actually documents; set
   `verified: true`. Add locality-specific sources (regional cultural office, museum, academic
   research, Budaya Kita records) where only the national portal is listed.
3. **Confirm references** that verified sources support (move from `toResearch` to `confirmed`).
4. **Design** the template using only confirmed references plus art direction. Keep sacred or
   restricted elements out unless explicitly approved for this use.
5. **Community review** with a knowledgeable local practitioner or cultural organisation. Record
   their names in `review.reviewers` (with permission), and their feedback in `review.notes`.
   Do not imply endorsement beyond what they agreed to.
6. Set `review.status: 'reviewed'`, `reference.review: 'reviewed'`, then the collection/template
   `status: 'available'`.

`validateCatalog()` / `validateBrief()` enforce steps 1, 2, 5 and 6: a cultural collection cannot
be `available` without review, named reviewers, at least one verified source and (if required) a
chosen locality, and nothing can be `confirmed` without a verified source. Tests fail otherwise.

## Next research step per collection

| Collection | Must decide first | Starting source(s) recorded |
|---|---|---|
| Javanese | Court or locality: Kasultanan Yogyakarta, Pakualaman, Kasunanan Surakarta, Mangkunegaran, or an East Java subregion (one per template) | UNESCO Indonesian Batik (general, not locality-specific) |
| Sundanese | Priangan or other locality (Cirebon is a distinct tradition — confirm self-identification); whether a siger-inspired form is appropriate | National portal only |
| Minangkabau | Nagari of origin (also for rantau couples) | Pandai Sikek songket study |
| Batak | Subtradition (Toba, Karo, Mandailing, Simalungun, Pakpak, Angkola) — and whether the couple identifies as Batak | Ulos Batak Toba record (Toba only; link failing) |
| Bugis | Locality (e.g. Bone, Wajo, Soppeng, communities elsewhere); local wedding examples | Wajo weaving-community research (not wedding-specific) |
| Betawi | Community (e.g. Betawi Tengah, Betawi Pinggir / Ora); verified Batik Betawi references | Roti Buaya record (link failing) |
| Malay | Locality (Siak, other Riau, Riau Islands, Deli/Langkat, Jambi, Palembang, Bangka Belitung, West Kalimantan …) | Tenun Siak record (Siak only; link failing) |
| Madura | Locality (Bangkalan, Sampang, Pamekasan, Sumenep, outlying islands, Pandalungan communities) | National portal only |
| Balinese | Locality and ceremonial context (options still to define) | National portal only |
| Dayak | Community (e.g. Ngaju, Iban, Kenyah, Kayan, Ma'anyan, Kanayatn, Benuaq) | Benang Bintik reference (link dead; Ngaju association unconfirmed) |
| Ambon / Maluku | Island or community across Maluku and North Maluku | National portal only |
| Papuan | Community and province (e.g. Biak, Asmat, Sentani, Dani/Hubula) | National portal only |
