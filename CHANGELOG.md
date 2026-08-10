# Changelog

All notable changes to the Pool Timer Card are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [2.11.1] - 2026-08-10

### Fixed
- **Deleting a preset left the card demanding its helper forever.** After migrating,
  the YAML `presets:` block is supposed to be only a seed, but the setup check kept
  treating it as the authority on which helpers must exist. Delete a preset from the
  card — which correctly removes both the option and its helper — and its YAML entry
  stayed behind, so the card reported a missing helper for a preset that no longer
  existed anywhere else.

  The loop was the bad part: pressing **Create helpers** to clear the warning recreated
  an `input_text` with no option pointing at it — precisely the orphan the delete had
  just avoided.

  Which presets need a helper is now decided by the `input_select`'s options once it
  exists, and only by the YAML before migration, when the YAML is genuinely all there
  is. An option added from **Settings → Helpers** with no YAML counterpart is created
  empty and shows disabled until you give it a schedule.

## [2.11.0] - 2026-08-10

### Changed
- **Presets are edited as time ranges again, not as a 48-character bitstring.** The
  server-side preset editor introduced in 2.10.0 exposed the raw storage format, which
  is unreadable and easy to miscount. It now takes `10:00-14:00, 16:00-19:30` — the same
  notation the YAML `presets:` always used — and converts to and from the bitstring
  underneath. The stored format is unchanged, so nothing else has to care.
  - Times snap to half hours, and the field **re-renders from what was actually
    stored**: type `10:15-14:20` and it comes back as `10:00-14:00`, rather than
    displaying a schedule the pump does not follow.
  - A range crossing midnight survives the round trip: `23:00-01:00` comes back as one
    range, not as `00:00-01:00, 23:00-24:00`.
  - Input that does not parse is rejected before anything is written, so a half-typed
    range can never reach a helper — and from there the pump.

## [2.10.1] - 2026-08-10

### Fixed
- **Creating a preset from the editor produced one you could select but that did
  nothing.** The new `input_text` was created empty, and the card only treated a
  *missing* helper as unusable — an existing-but-empty one rendered as a normal,
  selectable option. Selecting it silently applied nothing. Empty and malformed
  helpers are now treated exactly like missing ones: the option is disabled and marked
  with a warning, and it re-enables by itself the moment the helper holds a valid
  48-character schedule.

- **The preset dropdown did not repaint when a preset was added or removed.** Creating
  or deleting one changes only the `input_select`'s *options*, and the render
  fingerprint did not cover them, so the new preset appeared only after some unrelated
  state changed. The fingerprint now includes the preset list and each preset's
  usability. This is the same trap the theme fix in 2.9.6 had to close, in a second
  place.

### Changed
- **"+ Add Preset" now saves the schedule currently in force.** Created empty, a preset
  was unusable until you hand-typed 48 characters into the editor — a button that looked
  like it worked and did not. Seeding it from the dial makes adding a preset mean "save
  what I have", which is what pressing it is for.

## [2.10.0] - 2026-08-10

### Added
- **Presets can be stored on the server instead of in the card's YAML.** Set the new
  `preset_entity` option to an `input_select` and its options become your preset list;
  each preset's 48-character schedule lives in its own `input_text`. Automations, the
  blueprint and the card then all read the same data, so switching preset from an
  automation no longer means repeating the schedule string somewhere it can drift:

  ```yaml
  - action: input_select.select_option
    target: { entity_id: input_select.pool_timer_preset }
    data: { option: Verano }
  ```

  The preset's `input_text` is located by its **friendly name** (`Pool Timer Preset
  <name>`), never by entity id. Home Assistant does not guarantee a helper's entity id
  is derivable from its name or from its collection id — one whose id is
  `integracionalarmaajax` can live at `input_select.integracion_alarma_ajax` — so the
  name is the only stable link. It also removes slug collisions: `Verano 1` and
  `Verano-1` would slugify identically but are distinct names.

- **One-click migration.** *Create helpers* now also builds the `input_select` and one
  `input_text` per preset, **seeded with the schedules your YAML holds today**. Nothing
  breaks if you never press it: without `preset_entity` the card reads `presets:`
  exactly as before.

- **The visual editor manages presets.** Add, edit and delete, with deletion removing
  the option *and* its helper. The name is read-only: renaming means deleting and
  recreating the helper, so renaming is delete + create.

- **The blueprint gained an optional Preset helper input.** Selecting a preset applies
  its schedule server-side, with no dashboard open — which is the whole point.

### Changed
- The card follows the Home Assistant theme in the preset dropdown too: an option whose
  helper is missing renders disabled with a ⚠ rather than being hidden. Hiding it is
  baffling when you just added it in Settings, and selecting it would apply an empty
  schedule.
- With `preset_entity` set, the label derived from the segments is now pushed back to
  that entity, so the server reflects what is actually scheduled. Previous versions
  derived the label for display only.

### Upgrading
> [!IMPORTANT]
> **Re-import the blueprint** so the Preset helper input appears. Existing automations
> keep working untouched until you do — the new input defaults to empty.
>
> Then set `preset_entity` on the card and press **Create helpers** once to migrate.
> Both steps are optional: without them this release behaves exactly like 2.9.6.

### Notes
- An `input_text` caps at 255 characters, so storing every preset as one JSON blob was
  rejected: three presets already reach ~219 characters and the fourth would fail the
  service call. One helper per preset has no such ceiling and keeps the schedule
  readable.
- The blueprint writes in one direction only — it reads the `input_select` and writes
  the schedule, never the reverse. Deriving the label server-side as well would put both
  directions inside one `mode: restart` automation, where a single unguarded write
  becomes a ping-pong between two entities. The cost is that the selector can read stale
  if an automation writes the schedule *directly* with no dashboard open; it corrects
  itself as soon as one is opened.

## [2.9.6] - 2026-08-10

### Fixed
- **The card was painted black in the light theme, with near-black text on top of it.**
  The card background was declared as `var(--ha-card-background, #1C1C1E)`, but Home
  Assistant does **not** define `--ha-card-background` in its stock light theme — the
  variable is simply absent, so the declaration always fell through to its dark literal.
  Meanwhile `--primary-text-color` *is* defined and resolves to `#141414` there, which is
  how the card ended up rendering dark grey text on a black panel. The background now
  chains through `--card-background-color` (which HA does define) before reaching any
  literal.

### Changed
- **The card follows the Home Assistant theme.** Fixing the background alone would have
  left a white card carrying navy "off" segments, charcoal borders and dark dropdowns, so
  the whole palette is now theme-aware. `COLORS` became `PALETTE_DARK` / `PALETTE_LIGHT`,
  selected per render from `hass.themes.darkMode` — which is how HA reports the *resolved*
  theme, so "auto" correctly follows the operating system. Outside Home Assistant (the
  standalone preview) it falls back to `prefers-color-scheme`. **The dark palette is
  unchanged**, down to the hex values.
  - Colours that were hardcoded in the stylesheet moved into the palette too: control
    hover states, `<option>` backgrounds, the knob gradients and its ridges, and the
    shadows — which are much softer in the light theme, where a heavy drop shadow reads
    as grime rather than depth.
  - The skeuomorphic identity is deliberately preserved in both themes: cream dial face,
    blue segments, red needle, brushed-metal knob. Only their tone is nudged for contrast.
  - A theme switch now repaints immediately. The render fingerprint includes the resolved
    theme, so switching no longer waits for some unrelated state change to force a rebuild.
  - The live drag path reads the palette resolved by the last render, so segments painted
    mid-gesture get the right colour without a full re-render.

- **`preview.html` renders both themes side by side.** It reproduces the CSS variables a
  real HA 2026.8 instance exposes — including the *absence* of `--ha-card-background` in
  the light theme, which is the exact condition that triggered the bug.

## [2.9.5] - 2026-07-30

### Fixed
- **The preset label went stale when an automation changed the schedule.** Writing a
  preset *name* into the state helper only ever changed the dropdown label: nothing
  expanded that name into the 48 half-hour segments, and the server-side blueprint never
  reads the `preset` field at all. The 48-character string in the schedule helper is the
  single source of truth for the pump. The card now re-derives the preset label from the
  current segments on every state update, so a schedule written by an automation shows the
  matching preset name — or **Custom** when it matches none. Derivation only: the card
  writes nothing back for this.
- **Editing a preset in the visual editor corrupted the built-in defaults.**
  `setConfig()` assigned `DEFAULT_PRESETS` **by reference** when the card config declared
  no presets. The editor then took a *shallow* copy (`[...presets]`) and assigned into its
  elements — the very same objects — so renaming a preset or changing its time ranges
  mutated the module-level default for every card instance in the page session.
  `getStubConfig()` had the same flaw for **both** `DEFAULT_PRESETS` and
  `DEFAULT_QUICK_ACTIONS`, leaking them into every card created from the picker.
  All default hand-offs are now deep-cloned, and the six editor handlers deep-clone
  before mutating, so they no longer write into the live `_config` either.
  (`_parseQuickActions()` also returned `DEFAULT_QUICK_ACTIONS` by reference, but that
  branch is unreachable: the legacy `flocculant_hours` / `product_hours` fallback always
  builds fresh objects. Cloned regardless, so it cannot become a bug later.)
- **Preset and quick-action names are now HTML-escaped.** A name containing `"`, `<` or
  `&` broke the generated markup — in the card's own preset dropdown as well as in the
  editor — and injected into the shadow root. Added an `escapeHtml()` helper and applied
  it to every interpolation of a config-supplied string.

### Removed
- Dead `_loadSchedule()` and `_loadMode()`. Neither was called from anywhere: helper
  reads happen inline in `set hass`, which also carries the `_dragging` /
  `_lastSaveTime` guards. `_loadSchedule()` lacked those guards, so calling it would have
  reintroduced the v2.9.2 clobbering bug. A comment now records why they are absent.

### Changed
- `_applyDefaultSchedule()` now delegates to `_rangesToSegments()` instead of duplicating
  the range→segment conversion (including the midnight-wrap handling). One
  implementation, and the surviving one is the more defensive of the two.
- The reference photo moved to `assets/temporizador-fisico.jpg` (it lived in the repo
  root and is not referenced by the README), and a stray scratch note was removed from
  the root.

### Docs
- **README**: new section on driving the schedule from an automation — write the 48-char
  bitstring to the schedule helper, *not* a preset name to the state helper.

### Tooling
- **Pushing a `v*` tag now creates the GitHub release.** HACS resolves a repository's
  version from its latest *release*, not from git tags — a bare tag publishes nothing,
  which is why this version did not show up in HACS at first. `update-version.yml` is
  replaced by `release.yml`, which also verifies that `hacs.json` and the console banner
  match the tag, and builds the release notes from this file — so a release can no longer
  be published without its CHANGELOG entry (2.9.3 and 2.9.4 both shipped undocumented).
- The old workflow could never have worked: it rewrote the `version` key in `hacs.json`,
  which is not part of the HACS manifest spec and is ignored by HACS, and then ran
  `git push` from the detached HEAD that checking out a tag produces.
- `update-version.ps1` now takes the version as an argument
  (`./update-version.ps1 2.9.6`) instead of reading `git describe --tags`. The old order
  was backwards — the files have to be bumped *before* the tag exists for the release
  gate to check them.

## [2.9.4] - 2026-07-04

### Fixed
- **Never set an *Initial value* on the helpers** (schedule / state / mode). This was the
  root cause of the schedule and mode resetting to defaults on every Home Assistant
  restart: an `input_text` / `input_select` created with `initial` configured is reset to
  that value on every restart, whereas `RestoreEntity` only restores the last saved value
  when `initial` is unset. Removed `initial` from all three helper definitions in the
  one-click auto-setup, and it is now also cleared when the card fixes the schedule
  helper's `max`.
- Removed the diagnostic logging added in 2.9.3 while tracking this down.

## [2.9.3] - 2026-07-04

### Fixed
- **Helper writes are now awaited.** `_saveSchedule()`, `_saveMode()` and `_saveState()`
  became `async` and await confirmation of the service call, so a failed write no longer
  passes unnoticed.
- The schedule helper is now seeded with an empty string instead of 48 zeros, which is
  what lets the card tell "genuinely empty" apart from "not restored yet".

### Diagnostics
- Added console logging around helper persistence to trace the schedule being lost on HA
  restart while surviving a page refresh. (Removed again in 2.9.4 once the cause was
  found.)

## [2.9.2] - 2026-06-18

### Fixed
- **Schedule/mode reset to defaults after every HA restart.** Two causes:
  1. **Helpers configured with an *Initial value*** (48 zeros for the schedule, `Auto`
     for the mode). Home Assistant resets a helper to its initial value on every restart
     instead of restoring the last value. **Fix:** leave the *Initial value* empty so the
     helpers restore their last value (README updated). The card seeds the schedule on
     first use.
  2. **The card overwrote the helper during startup.** While HA was starting, the helper
     briefly read `unknown`/`unavailable`; the card treated that as "empty" and wrote the
     default schedule over the value the helper was about to restore. Now the card only
     seeds on a genuinely empty (`''`) helper and waits for transient states to resolve.

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
