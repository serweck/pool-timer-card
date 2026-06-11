# Changelog

All notable changes to the Pool Timer Card are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [2.9.1] - 2026-06-11

### Added
- **Corner actions can press buttons**: added the `button` service domain and
  `press` / `trigger` actions to the editor, so a corner button can fire a
  one-shot `button` entity (e.g. *start pool robot*), a `scene`, or `automation`.
  `_callCornerAction` normalizes single-verb domains (`button` → `press`,
  `scene` → `turn_on`) so they work even if the action dropdown is left at its
  default. (Also removed a dead variable in `_callCornerAction`.)

## [2.9.0] - 2026-06-11

### Added
- **Corner Actions are now configurable from the visual editor**. The card editor
  has a new **Corner Actions** section: add/remove entries and set icon, name,
  corner position (top-left / top-right / bottom-left / bottom-right), entity,
  service domain and action (toggle / on / off) per row — no YAML required.
  Mirrors the existing Quick Actions / Presets editors and writes the same
  `corner_actions:` config.

## [2.8.8] - 2026-06-11

### Docs / Tooling
- **README** updated for the touch gesture model (tap / horizontal drag to edit,
  vertical swipe to scroll) and the new preset-matching behaviour (a manual edit
  that matches a preset adopts it instead of showing "Custom").
- **Console banner** version is no longer hardcoded out of date (was stuck at
  `v2.8.3`). `update-version.ps1` now syncs **both** `hacs.json` and the JS
  banner from the latest git tag, and replaces only the version substring so it
  no longer reformats `hacs.json`. The banner is the quickest way to confirm
  which version the browser/app actually loaded (see Troubleshooting).

## [2.8.7] - 2026-06-11

### Fixed
- **Scroll over the card finally works — the actual root cause**: the `.card`
  wrapper (which covers the whole card) had `touch-action: none`. Because the
  effective touch-action is the **intersection** of every ancestor's value, that
  `none` overrode the `pan-y` set on inner elements in 2.8.4–2.8.6 and blocked
  page scrolling anywhere over the card. Changed `.card` to `touch-action: pan-y`.
  Vertical swipes now scroll; tap / horizontal drag still edits the dial.

## [2.8.6] - 2026-06-11

### Fixed
- **Android app: vertical scroll over the dial (root cause)**: `touch-action`
  was only set on the SVG (`<svg>` / `<path>`), which the Android WebView
  (Chromium) does not reliably honor on SVG elements — so a vertical swipe over
  the dial never started a page scroll. Moved `touch-action: pan-y` onto the
  HTML `.dial-container` wrapper, which is honored. Combined with the gesture
  intent detection from 2.8.5 (tap / horizontal = edit, vertical = scroll),
  swiping past the card now scrolls on Android (and iOS).

## [2.8.5] - 2026-06-11

### Fixed
- **Mobile scroll still blocked over the dial (real fix)**: 2.8.4 only freed the
  center/gaps, but the segments fill most of the ring, so a swipe that lands on a
  segment was still stuck. The dial now detects gesture intent: a **tap** or a
  **horizontal drag** edits the schedule, while a **vertical drag** is left to
  the browser as a page scroll (segments use `touch-action: pan-y`, and the edit
  is deferred on touch until ~8px of movement reveals the direction). Mouse
  behaviour (instant click + drag-paint) is unchanged.

## [2.8.4] - 2026-06-11

### Fixed
- **Mobile scrolling blocked over the dial**: dragging the dashboard past the
  card on touch devices got stuck because the dial captured every gesture. Now
  `touch-action` is scoped — only gestures that *start on a segment* edit the
  schedule (`touch-action: none`), while touches on the rest of the dial
  (center knob, ticks, gaps) scroll the page vertically (`touch-action: pan-y`).
  Editing segments still works in any mode, including OFF.

### Changed
- **Manual edits that match a preset adopt that preset**: after editing the
  dial by hand, if the resulting schedule matches a configured preset exactly,
  the preset selector now shows that preset instead of falling back to
  "Custom".

## [2.8.3] - 2026-06-10

### Fixed
- **Blueprint silently aborted on some HA versions**: the `variables:` block had
  templated variables referencing other templated variables (e.g. `st` used `raw`),
  which fails to render on some Home Assistant versions and aborts the run before any
  action — looking exactly like "the trigger never fires". Rewrote every computed
  variable to be **self-contained** (each re-derives from the four entity inputs in a
  single template scope, referencing no other computed variable).
- **Blueprint `mode`**: `single` + `max_exceeded: silent` could silently drop every
  minute tick while a prior (e.g. hung switch call) run was still active. Changed to
  `mode: restart`.

## [2.8.2] - 2026-06-10

### Fixed
- **Corner action visual updates**: the render signature now includes corner action
  states, so the card re-renders when a corner entity (e.g., a light) changes state
  in Home Assistant. Before, you had to reload the page to see the glow update.

## [2.8.1] - 2026-06-10

### Fixed
- **Blueprint trigger syntax**: changed from `minutes: "/1"` to `seconds: 0`. Home
  Assistant's `time_pattern` doesn't support `*/N` notation; use `seconds: 0` to
  trigger at the start of each minute. The automation was not firing at all
  before this fix.

## [2.8.0] - 2026-06-10

### Added
- **Browser-independent operation** via a Home Assistant **blueprint**
  (`blueprints/pool_timer.yaml`). It runs server-side every minute (and on HA
  restart) and reproduces the card's full state machine (Auto schedule, Perm/OFF,
  running timed actions, the flocculant "settling" lock, and post-action
  transitions), so the pump is driven 24/7 even with no browser open. Imported with
  one click — entities are picked from dropdowns, no YAML editing.
- The state helper JSON now includes an **`after`** field so the server can apply a
  timed action's post-behavior without knowing the card config — the helper stays a
  self-describing single source of truth.

### Changed
- **The blueprint is now required**: the card no longer drives the pump on its 60s
  timer — it delegates pump control to the blueprint and acts as a pure UI. Explicit
  user taps still drive the switch immediately for a snappy response.
- README: replaced the partial "end treatment on time" automation with a complete
  **"Required: install the blueprint"** section (import badge + setup steps).

### Migration
- After updating, **import the blueprint and create the automation** (see README).
  Without it, the schedule will not be enforced while no browser is open.

## [2.7.2] - 2026-06-10

### Added
- **Comprehensive corner actions documentation** in README with full YAML examples
  and parameter descriptions.

### Changed
- **Corner action button design**: now **icon-only** (no background border, no box).
  Hover effect: icon scales up with subtle drop-shadow glow.
- **Configurable corner positions**: each corner action now has a `position` field
  (`tl`, `tr`, `bl`, `br` or full names `top-left`, etc.) so you can place buttons
  in any corner, instead of auto-filling positions 0-3.
- **Active state visual**: when a light is ON, the icon color changes to green with
  a brighter glow (instead of the blue border styling).

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

[2.7.2]: https://github.com/serweck/pool-timer-card/releases/tag/v2.7.2
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
