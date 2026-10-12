# Auto-update Trait / Title / Perk

This test repo includes a separate GitHub Actions workflow for `character-extras.json`.

- Runs daily at 02:47 UTC (09:47 Vietnam time), and can also be started manually from **Actions → Update Trait Title Perk data → Run workflow**.
- Reads character profile pages from `https://gomg-wiki.pages.dev/units/`.
- Updates only `character-extras.json`; it does not modify `game-data.json`, `app.js`, or `ai-combo.js`.
- It refuses to overwrite data when the discovered profile count is suspiciously low or too many pages fail.
- It preserves prior records when an existing profile cannot be read, or is temporarily absent from the index.

Important: GitHub Actions has to be enabled for this repository. The first run should be manual so its logs can be checked before relying on the daily schedule.
