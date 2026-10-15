# JetFarm Agribusiness Module — Promo Video · Script & Build Notes

Final video: `docs/media/jetfarm-agribusiness.mp4` (16:9, 1920x1080, 30 fps, ~1:46)
Voice: Edge TTS `en-US-AriaNeural` · Music: locally synthesized ambient pad (no third-party audio)
Source: `app/(admin)/agribusiness/` screens (parcels, cycles, harvest, expenses/labor, mapping, investors, settlements, analytics, accounting)

## Voiceover script (per slide)

| # | Slide | Voiceover |
|---|-------|-----------|
| 1 | Intro — Agribusiness module | This is the JetFarm Agribusiness module, everything your farm operation needs, from soil to settlement. |
| 2 | Land & parcels | Know every parcel. Register each field by area, and track its status from available, to planted, to harvesting. |
| 3 | Crop cycles | Grow by the calendar. Plan structured crop cycles that move from land prep, through germination and vegetative growth, all the way to harvest. |
| 4 | Harvest | Log every harvest. Record net weights, total your yield in kilograms, and tie every result back to its parcel and cycle. |
| 5 | Inputs & labor | Track the costs that count. From fertilizer, crop protection, and machinery, to seedlings and field labor, every input is accounted for. |
| 6 | Field mapping | Map your land on the ground. Capture GPS boundaries on site, and connect every parcel to its real production records. |
| 7 | Investors | Bring investors along. Manage partners, keep transparent contribution records, and share the harvest with fair, rule-based returns. |
| 8 | Settlements | Settle up every week. Generate settlement sheets with net payouts calculated automatically, then draft, approve, and pay with confidence. |
| 9 | Analytics & books | See performance, and balance the books. Yield benchmarks, productivity insights, and double-entry accounting, all in one place. |
| 10 | Outro | Jet Farm Agribusiness. Farm smarter, and harvest with confidence. Part of the all-in-one Jet Farm platform. |

## How to re-render after edits

The pipeline is shared with the main promo and takes a working-directory argument.

1. Edit copy in `tmp/jetfarm-promo/agri/promo.json` (slide text + `vo` lines; use `**word**` in a headline to color it green).
2. `node tmp/jetfarm-promo/render-slides.js tmp/jetfarm-promo/agri`
3. `python tmp/jetfarm-promo/make_voiceover.py tmp/jetfarm-promo/agri`
4. `python tmp/jetfarm-promo/assemble.py tmp/jetfarm-promo/agri`

Output name is set by the `"output"` key in `promo.json`.
