# Alter name handling

The updater now treats each Alter as a separate unit.

- Stable matching uses the source unit ID (`source_id`) first.
- Alter display names include their variant, for example `Imp (Swimsuit)` and `Imp (Pajama)`.
- If a source ever supplies duplicate names without a usable variant, the updater adds the stable source ID in brackets rather than merging or overwriting one unit.
- Existing tracker IDs are preserved whenever the same source ID is seen again.

This is intentionally implemented in the database updater rather than as a cosmetic UI-only change, so future automatic updates keep the distinction.
