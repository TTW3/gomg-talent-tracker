# GOMG Talent Tracker – automatic game-data updates

The tracker keeps user assignments in browser `localStorage`; `game-data.json` is only the shared reference database shipped with the site.

## Sources
- Primary unit source: https://gomg-wiki.pages.dev/units/
- Supplemental source probe: https://hxsngh.pages.dev/#/role
- Existing curated talent source: https://mocha-gameguide.com/gensho/talents/

## How it works
GitHub Actions runs every Monday at 03:17 UTC (10:17 Vietnam time) and can also be run manually from **Actions → Update GOMG game data → Run workflow**.

The updater:
1. Downloads the GMG Wiki Units index.
2. Parses standard + alter units and safely refuses to overwrite the database if the result looks broken.
3. Preserves the tracker's curated English talent list instead of guessing translations.
4. Probes the hxsngh app for machine-readable JSON/CSV assets; if its internal structure changes, the update still succeeds using the primary source.
5. Commits `game-data.json` only when something changed.

### Important
The GitHub repository must contain the `.github/workflows/update-game-data.yml` and `tools/update_game_data.py` files. In **Settings → Actions → General**, workflow permissions should allow the workflow to read and write repository contents. The workflow itself also declares `permissions: contents: write`.
