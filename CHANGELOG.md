# Changelog

All notable changes to the Pool Timer Card are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [2.1.0] - 2026-06-10

### Added
- **One-click helper auto-setup.** If any required helper is missing (or the
  schedule helper's `max` is below 48), the card shows a banner with a
  *Create helpers* / *Fix it* button. For admins it creates the helpers and
  fixes the `max` via the HA WebSocket collection API (`input_text/create`,
  `input_select/create`, `input_text/update`). Non-admins get an instruction note.

## [2.0.0] - 2026-06-10

### Added
- **Presets**: one-tap named schedules (defaults `Verano` / `Invierno`),
  configurable via the `presets:` option. Selecting a preset loads its
  48-segment schedule and switches to Auto.
- **Flocculant quick action**: circulates the pump for `flocculant_hours`
  (default 2h), then locks the pump OFF (a *settling* state) until the user
  vacuums the bottom and presses *resume*.
- **Treatment quick action** (shock / product): runs the pump for
  `product_hours` (default 3h), then automatically returns to the previous mode.
- **Action banner** with live countdown and Cancel / Resume controls.
- New helper `input_text.pool_timer_state` persists the active preset and any
  running action as JSON, so timed actions resume correctly after a reload.
- New config options: `state_entity`, `flocculant_hours`, `product_hours`,
  `presets`.
- Optional server-side automation example to enforce action timing when no
  dashboard is open (see README).

### Notes
- Timed actions are evaluated by the card; the automatic transition fires while
  a dashboard with the card is open. State is persisted for correct resume.

## [1.2.0] - 2026-06-10

### Fixed
- **Schedule not saving / segments reverting.** Reworked the entire pointer
  interaction so the DOM is no longer rebuilt mid-gesture (which destroyed the
  captured element and lost the `pointerup`). Segments are now painted in place,
  drag uses hit-testing via `elementFromPoint`, the release is caught on
  `window`, and changes are saved redundantly (debounced while editing +
  immediate on release).

## [1.1.0] - 2026-06-10

### Fixed
- Race condition where a frequent `set hass()` update from Home Assistant could
  overwrite an in-progress segment edit before it was saved. Remote sync is now
  suppressed while dragging and within the post-save lockout window; the clock
  tick no longer re-renders mid-interaction; global pointer listeners are bound
  once instead of accumulating on every render.

## [1.0.0] - 2026-06-08

### Added
- Initial release: skeuomorphic 24-hour dial, 48 half-hour segments, Auto / Perm
  / OFF modes, real-time needle, exponential-backoff retry, English/Spanish i18n,
  HACS support and a visual config editor.

[2.1.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.1.0
[2.0.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.0.0
[1.2.0]: https://github.com/serweck/pool-timer-card/releases/tag/v1.2.0
[1.1.0]: https://github.com/serweck/pool-timer-card/releases/tag/v1.1.0
[1.0.0]: https://github.com/serweck/pool-timer-card/releases/tag/v1.0.0
