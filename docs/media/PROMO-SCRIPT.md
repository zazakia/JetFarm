# JetFarm Promo Video — Script & Build Notes

Final video: `jetfarm-promo.mp4` (16:9, 1920x1080, 30 fps, ~89 s)
Voice: Edge TTS `en-US-AriaNeural` · Music: locally synthesized ambient pad (no third-party audio)

## Voiceover script (per slide)

| # | Slide | Voiceover |
|---|-------|-----------|
| 1 | Intro — JetFarm wordmark | This is JetFarm, the all-in-one management system for farms and cooperatives. |
| 2 | Point of sale | Point of sale made simple. Ring up sales, track inventory, and take payments, even when the internet goes down. |
| 3 | Lending | Lending, under control. Members apply, encoders approve, payments are recorded, and collectors hit the field with daily collection sheets. |
| 4 | Savings | Save and grow. Members build savings and time deposits, with loan products and penalties that follow your cooperative's own rules. |
| 5 | Business units | Every business unit, one app. The agri store, water station, pharmacy, and transport, each with its own module, all on the same books. |
| 6 | Accounting | Expenses and accounting, built in. Capture receipts, manage categories, and keep a balanced ledger automatically. |
| 7 | Insights | See the whole picture. Role-based dashboards for admins, collectors, and members, plus more than thirty-five reports. |
| 8 | Offline first | Offline first, always in sync. Work anywhere. JetFarm syncs securely to the cloud the moment you're back. |
| 9 | Outro | Jet Farm. Run your cooperative, grow your future. Available now on Android and the web. |

## How to re-render after edits

1. Edit text in `tmp/jetfarm-promo/promo.json` (slide copy + `vo` lines).
2. `node tmp/jetfarm-promo/render-slides.js` — re-renders slide PNGs.
3. `python tmp/jetfarm-promo/make_voiceover.py` — regenerates MP3s + durations.
4. `python tmp/jetfarm-promo/assemble.py` — rebuilds the MP4.

Dependencies (installed via `python -m pip`): `edge-tts`, `imageio-ffmpeg` (bundles ffmpeg 7.1). Slide rendering uses the project's existing Playwright Chromium.
