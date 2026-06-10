# Changelog

All notable changes to the Pool Timer Card are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [2.7.1] - 2026-06-10

### Changed
- **Corner action buttons visual redesign**: transparent/frosted glass appearance
  instead of solid blue background. Borders glow on hover.
- **Active state for lights**: when a corner action is a light entity and it's
  currently ON, the button shows the `--active` styling (bright border, glow,
  white text) for instant visual feedback.

## [2.7.0] - 2026-06-10

### Added
- **Corner action buttons**: up to 4 quick-toggle buttons in the dial's corners
  (top-left, top-right, bottom-left, bottom-right). Each executes a HA service
  immediately (no timer). Configure in YAML:
  ```yaml
  corner_actions:
    - name: "Jacuzzi"
      icon: "🛁"
      service: "switch"
      entity_id: "switch.jacuzzi"
      action: "toggle"
    - name: "Pool Lights"
      icon: "💡"
      service: "light"
      entity_id: "light.pool_lights"
      action: "toggle"
    - name: "Pool Robot"
      icon: "🤖"
      service: "switch"
      entity_id: "switch.pool_robot"
      action: "turn_on"
  ```
  Services: any HA service (switch, light, automation, etc.). Actions: toggle,
  turn_on, turn_off.

## [2.6.3] - 2026-06-10

### Fixed
- **Home Assistant freezing / unresponsive**: when a quick action with
  `after: Auto` (the default for "Treatment") or `after: <preset>` finished,
  `_computeDesiredState()` returned `null`. `_evaluateSchedule()` then tried to
  drive the pump to `null`, which never matches `on`/`off`, firing an endless
  storm of `switch.turn_off` + retry service calls that hammered HA. The
  function now always returns `on`/`off`, falling through to the mode/schedule
  after an action expires.
- Added a guard in `_callServiceWithRetry()` so a non-`on`/`off` target can
  never spam services again.
- Fixed the "next change" hint showing while the first action (index `0`) was
  active (`if (this._action)` is falsy for `0`).

## [2.6.2] - 2026-06-10

### Fixed
- Icon-only actions: a blank action name was replaced with the word "Action"
  in `_parseQuickActions`. An empty name now stays empty so only the icon shows.

## [2.6.1] - 2026-06-10

### Fixed
- **Card flickering**: `set hass()` rebuilt the whole DOM on every Home Assistant
  state change (fires constantly). Now a render fingerprint skips the rebuild
  unless something the card actually shows has changed.
- **First action vanished when activated**: the action index is stored as a
  number, but `0` is falsy — `this._action || null` cleared the first action
  immediately after starting it. Replaced with explicit null checks in both
  save and load paths.
- **Editor layout / misaligned headers / "After" overflowing**: added
  `box-sizing: border-box`, made fields `width: 100%`, and gave the header and
  rows the same grid template so columns line up in HA's narrow editor panel.
- **Crash on adding a fresh card**: `getStubConfig()` referenced removed
  constants (`DEFAULT_FLOCCULANT_HOURS` / `DEFAULT_PRODUCT_HOURS`); now uses
  `DEFAULT_QUICK_ACTIONS`.

## [2.6.0] - 2026-06-10

### Added
- **Visual configuration editor**: no more YAML needed — add/edit/delete
  quick actions and presets using a graphical UI directly in Home Assistant.
- Action editor fields: name, hours, icon, and "after" behavior.
- Preset editor: enter times as "08:00-13:00, 16:00-20:00" or edit individually.
- All helpers can be configured visually.

## [2.5.0] - 2026-06-10

### Changed
- **Configurable quick actions**: replace hardcoded Flocculant/Treatment with
  unlimited user-defined actions. Each action has a name, duration, icon,
  and "after" behavior (lock OFF, return to mode, or load preset).
- Actions automatically wrap to fit the card width.

### Added
- `quick_actions` config array with format:
  ```yaml
  quick_actions:
    - name: "Flocculant"
      hours: 2
      icon: "🌀"
      after: "OFF"           # OFF, Auto, or preset name
  ```

### Deprecated
- `flocculant_hours` and `product_hours` (still supported for backward
  compatibility, but use `quick_actions` for new setups).

## [2.4.0] - 2026-06-10

### Changed
- **Compact controls layout**: mode, presets, and quick actions now share one
  horizontal row for cleaner UI and better responsive behavior.
- **Smart select handling**: prevents re-renders while a dropdown is open,
  eliminating the issue where opening a select would immediately close it.

### Fixed
- Dropdown menus stay open during interaction (no more premature closing).

## [2.3.1] - 2026-06-10

### Fixed
- **Button flickering on hover** — removed `transition: all` from buttons and
  selectors that caused jitter and re-render flicker when hovering.

## [2.3.0] - 2026-06-10

### Added
- **Presets as dropdown menu**: when presets are configured, a dropdown
  lets you quickly switch between them + a **Custom** option to edit manually.
  Selecting *Custom* clears the preset and you can edit segments on the dial.
- **Auto-Custom mode**: when you manually edit a segment on the dial, the preset
  automatically switches to *Custom* and stays in edit mode.

## [2.2.0] - 2026-06-10

### Added
- **Conditional UI rendering**: presets only show if configured; quick actions only show if
  durations are set.
- **Smart mode selector**: when presets are configured, the mode selector becomes a
  dropdown menu (faster preset switching). Without presets, it stays as 3 buttons.

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

[2.7.1]: https://github.com/serweck/pool-timer-card/releases/tag/v2.7.1
[2.7.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.7.0
[2.6.3]: https://github.com/serweck/pool-timer-card/releases/tag/v2.6.3
[2.6.2]: https://github.com/serweck/pool-timer-card/releases/tag/v2.6.2
[2.6.1]: https://github.com/serweck/pool-timer-card/releases/tag/v2.6.1
[2.6.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.6.0
[2.5.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.5.0
[2.4.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.4.0
[2.3.1]: https://github.com/serweck/pool-timer-card/releases/tag/v2.3.1
[2.3.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.3.0
[2.2.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.2.0
[2.1.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.1.0
[2.0.0]: https://github.com/serweck/pool-timer-card/releases/tag/v2.0.0
[1.2.0]: https://github.com/serweck/pool-timer-card/releases/tag/v1.2.0
[1.1.0]: https://github.com/serweck/pool-timer-card/releases/tag/v1.1.0
[1.0.0]: https://github.com/serweck/pool-timer-card/releases/tag/v1.0.0
