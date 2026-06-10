/**
 * Pool Timer Card — Custom Lovelace Card for Home Assistant
 *
 * A skeuomorphic 24-hour mechanical pool timer that controls a pump switch
 * via 48 half-hour segments, with selectable presets (e.g. Summer/Winter)
 * and timed quick-actions for pool treatment:
 *   - Flocculant: circulate for N hours, then lock the pump OFF until you have
 *     vacuumed the settled dirt and press "resume".
 *   - Treatment (shock/product): run for N hours, then return to the previous mode.
 *
 * Installation:
 *   1. Copy this file to /config/www/community/pool-timer-card/pool-timer-card.js
 *   2. Add as resource in Lovelace: /hacsfiles/pool-timer-card/pool-timer-card.js (JS module)
 *   3. Create helpers (see README): an input_text for the schedule (max >= 48!),
 *      an input_select for the mode, and an input_text for the action/preset state.
 *
 * Configuration:
 *   type: custom:pool-timer-card
 *   entity: switch.depuradora_piscina
 *   name: Pool Timer
 *   schedule_entity: input_text.pool_timer_schedule
 *   mode_entity: input_select.pool_timer_mode
 *   state_entity: input_text.pool_timer_state
 *   flocculant_hours: 2
 *   product_hours: 3
 *   presets:
 *     - name: Verano
 *       schedule:
 *         - { start: "08:00", end: "13:00" }
 *         - { start: "16:00", end: "20:00" }
 *     - name: Invierno
 *       schedule:
 *         - { start: "10:00", end: "13:00" }
 */

/* ------------------------------------------------------------------ */
/*  i18n                                                               */
/* ------------------------------------------------------------------ */
const TRANSLATIONS = {
  en: {
    pump_on: 'Pump: ON',
    pump_off: 'Pump: OFF',
    next_change: 'Next change',
    at: 'at',
    mode_auto: 'Auto',
    mode_perm: 'On',
    mode_off: 'OFF',
    retrying: 'Retrying…',
    retry_failed: 'Connection failed',
    no_change: 'No changes scheduled',
    title_default: 'Pool Timer',
    editor_entity: 'Pump switch entity',
    editor_name: 'Card name',
    editor_schedule: 'Schedule helper (input_text)',
    editor_mode: 'Mode helper (input_select)',
    presets: 'Presets',
    actions: 'Quick actions',
    flocculant: 'Flocculant',
    product: 'Treatment',
    cancel: 'Cancel',
    resume: 'Bottom cleaned — resume',
    flocculant_running: 'Flocculant: circulating',
    flocculant_settling: 'Flocculant: let it settle, then vacuum the bottom',
    product_running: 'Treatment running',
    remaining: 'left',
    returns_to: 'back to',
    setup_title: 'Setup needed',
    setup_missing: 'Required helpers are missing.',
    setup_create: 'Create helpers',
    setup_max_issue: 'The schedule helper max length is below 48, so it can\'t save.',
    setup_fix: 'Fix it',
    setup_admin_only: 'Ask an administrator to create the required helpers.',
    setup_busy: 'Working…',
    setup_error: 'Setup failed — see the browser console.',
  },
  es: {
    pump_on: 'Bomba: ON',
    pump_off: 'Bomba: OFF',
    next_change: 'Próximo cambio',
    at: 'a las',
    mode_auto: 'Auto',
    mode_perm: 'On',
    mode_off: 'OFF',
    retrying: 'Reintentando…',
    retry_failed: 'Fallo de conexión',
    no_change: 'Sin cambios programados',
    title_default: 'Pool Timer',
    editor_entity: 'Entidad del switch de la bomba',
    editor_name: 'Nombre de la tarjeta',
    editor_schedule: 'Helper de programación (input_text)',
    editor_mode: 'Helper de modo (input_select)',
    presets: 'Presets',
    actions: 'Acciones rápidas',
    flocculant: 'Floculante',
    product: 'Producto',
    cancel: 'Cancelar',
    resume: 'Fondo limpio — reanudar',
    flocculant_running: 'Floculante: circulando',
    flocculant_settling: 'Floculante: deja reposar y limpia el fondo',
    product_running: 'Tratamiento en curso',
    remaining: 'restante',
    returns_to: 'vuelve a',
    setup_title: 'Falta configuración',
    setup_missing: 'Faltan helpers necesarios.',
    setup_create: 'Crear helpers',
    setup_max_issue: 'El helper del horario tiene longitud máxima menor de 48 y no puede guardar.',
    setup_fix: 'Arreglar',
    setup_admin_only: 'Pide a un administrador que cree los helpers necesarios.',
    setup_busy: 'Trabajando…',
    setup_error: 'Error en la configuración — mira la consola del navegador.',
  },
};

function t(key, lang) {
  const l = (lang || 'en').substring(0, 2).toLowerCase();
  return (TRANSLATIONS[l] && TRANSLATIONS[l][key]) || TRANSLATIONS.en[key] || key;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const SEGMENT_COUNT = 48;            // 48 × 30 min = 24 h
const SVG_SIZE = 400;                // viewBox units
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;

// Radii (from outside inward)
const R_SEG_OUTER = 190;
const R_SEG_INNER = 160;
const R_NUM_RING  = 142;
const R_TICK_OUTER = 155;
const R_TICK_INNER = 148;
const R_NEEDLE    = 155;
const R_KNOB      = 50;

const COLORS = {
  bg:          '#1C1C1E',
  segOn:       '#4A90D9',
  segOnStroke: '#5BA0E9',
  segOff:      '#1A3A5C',
  segOffStroke:'#0F2640',
  segHover:    '#6BB0F0',
  numBg:       '#F5F5F0',
  numText:     '#2C2C2E',
  needle:      '#FF3B30',
  ledOn:       '#34C759',
  ledOff:      '#FF3B30',
  ledRetry:    '#FF9500',
  modeActive:  '#4A90D9',
  modeInactive:'#3A3A3C',
  border:      '#3A3A3C',
  cardBg:      'var(--ha-card-background, #1C1C1E)',
  textPrimary: 'var(--primary-text-color, #E5E5E7)',
  textSecondary:'var(--secondary-text-color, #8E8E93)',
};

/* ------------------------------------------------------------------ */
/*  Retry logic — exponential backoff                                  */
/* ------------------------------------------------------------------ */
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

/* ------------------------------------------------------------------ */
/*  Default presets (overridable via card config `presets:`)           */
/* ------------------------------------------------------------------ */
const DEFAULT_PRESETS = [
  { name: 'Verano',   schedule: [{ start: '08:00', end: '13:00' }, { start: '16:00', end: '20:00' }] },
  { name: 'Invierno', schedule: [{ start: '10:00', end: '13:00' }] },
];

/* Default quick actions (configurable via card config `quick_actions:`) */
const DEFAULT_QUICK_ACTIONS = [
  { name: 'Flocculant', hours: 2, icon: '🌀', after: 'OFF' },
  { name: 'Treatment', hours: 3, icon: '🧪', after: 'Auto' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function num(v, def) {
  return Number(v) > 0 ? Number(v) : def;
}

function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/* ------------------------------------------------------------------ */
/*  Helper: segment arc path                                           */
/* ------------------------------------------------------------------ */
function segmentArc(cx, cy, rOuter, rInner, startDeg, endDeg) {
  const gap = 0.6; // degrees gap between segments
  const s = startDeg + gap / 2;
  const e = endDeg - gap / 2;
  const p1 = polarToXY(cx, cy, rOuter, s);
  const p2 = polarToXY(cx, cy, rOuter, e);
  const p3 = polarToXY(cx, cy, rInner, e);
  const p4 = polarToXY(cx, cy, rInner, s);
  const large = e - s > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

/* ------------------------------------------------------------------ */
/*  Main card class                                                    */
/* ------------------------------------------------------------------ */
class PoolTimerCard extends HTMLElement {

  /* ----- lifecycle ------------------------------------------------ */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._segments = new Array(SEGMENT_COUNT).fill(false);
    this._mode = 'Auto';          // Auto | Perm (On) | OFF
    this._retryState = 'idle';    // idle | retrying | failed
    this._retryTimer = null;
    this._retryCount = 0;
    this._targetSwitchState = null;
    this._clockInterval = null;
    this._scheduleInterval = null;
    this._dragging = false;
    this._dragValue = null;
    this._lang = 'en';
    this._initialized = false;
    this._lastSaveTime = 0;
    this._rootEventsBound = false;
    this._saveDebounce = null;
    // Stable reference so we can add/remove the window-level release listener.
    this._boundPointerUp = () => this._onGlobalPointerUp();
    // Presets & timed actions
    this._preset = null;          // name of the active preset
    this._action = null;          // null | 'flocculant' | 'product' | 'settling'
    this._actionUntil = 0;        // epoch ms when the ON phase of an action ends
    this._returnMode = 'Auto';    // base mode to restore after a timed action
    this._lastStateSaveTime = 0;  // lockout for the action/preset state helper
    // One-click helper setup
    this._setupBusy = false;
    this._setupError = null;
  }

  /* ----- HA interface --------------------------------------------- */
  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define an entity (switch.*)');
    }
    this._config = {
      name: '',
      ...config,
      entity: config.entity,
      schedule_entity: config.schedule_entity || 'input_text.pool_timer_schedule',
      mode_entity: config.mode_entity || 'input_select.pool_timer_mode',
      state_entity: config.state_entity || 'input_text.pool_timer_state',
      quick_actions: this._parseQuickActions(config),
      corner_actions: this._parseCornerActions(config),
      presets: (Array.isArray(config.presets) && config.presets.length)
        ? config.presets
        : DEFAULT_PRESETS,
    };
    // Apply initial schedule from config only if it's the very first setup and we don't have segments loaded
    if (config.schedule && Array.isArray(config.schedule) && !this._initialized) {
      this._applyDefaultSchedule(config.schedule);
    }
  }

  _parseQuickActions(config) {
    // Support new quick_actions format, fall back to legacy flocculant_hours/product_hours
    if (Array.isArray(config.quick_actions) && config.quick_actions.length) {
      return config.quick_actions.map(a => ({
        // Keep an empty name empty — the card then shows the icon only.
        name: (a.name || '').trim(),
        hours: num(a.hours, 2),
        icon: a.icon || '⏱️',
        after: a.after || 'Auto',  // 'OFF', 'Auto', or preset name
      }));
    }
    // Legacy: build default actions from flocculant_hours / product_hours
    const actions = [];
    const flocHours = num(config.flocculant_hours, 2);
    const prodHours = num(config.product_hours, 3);
    if (flocHours > 0) actions.push({ name: 'Flocculant', hours: flocHours, icon: '🌀', after: 'OFF' });
    if (prodHours > 0) actions.push({ name: 'Treatment', hours: prodHours, icon: '🧪', after: 'Auto' });
    return actions.length ? actions : DEFAULT_QUICK_ACTIONS;
  }

  _parseCornerActions(config) {
    // Parse corner_actions: array of quick-toggle actions (no timer)
    // Each has: name, icon, position (tl/tr/bl/br or top-left/top-right/bottom-left/bottom-right),
    // service (service domain), entity_id, action (turn_on/turn_off/toggle)
    if (!Array.isArray(config.corner_actions)) return [];
    const positionMap = {
      'tl': 'tl', 'top-left': 'tl',
      'tr': 'tr', 'top-right': 'tr',
      'bl': 'bl', 'bottom-left': 'bl',
      'br': 'br', 'bottom-right': 'br',
    };
    return config.corner_actions.map(a => ({
      name: a.name || 'Action',
      icon: a.icon || '◆',
      position: positionMap[a.position] || a.position || null,  // null = no position (skip)
      service: a.service || 'switch',     // e.g. 'switch', 'light'
      entity_id: a.entity_id || '',
      action: a.action || 'toggle',       // turn_on, turn_off, toggle
    }));
  }

  set hass(hass) {
    this._hass = hass;
    // Detect language
    this._lang = (hass.language || hass.locale?.language || 'en');
    // Initialize select state flag
    if (!this._selectOpen) this._selectOpen = false;

    // Sync mode from helper (other automations may change it)
    const modeState = hass.states[this._config.mode_entity];
    if (modeState && modeState.state) {
      const m = modeState.state;
      if (['Auto', 'Perm', 'OFF'].includes(m) && m !== this._mode) {
        this._mode = m;
      }
    }

    // Sync schedule from helper
    const schedState = hass.states[this._config.schedule_entity];
    const timeSinceLastSave = Date.now() - (this._lastSaveTime || 0);

    if (schedState && schedState.state && schedState.state.length === SEGMENT_COUNT) {
      const newSegs = schedState.state.split('').map(c => c === '1');
      // Don't clobber local segments while the user is actively editing (_dragging),
      // nor inside the lockout window right after a manual save (_lastSaveTime).
      if (!this._dragging && timeSinceLastSave > 3000) {
        if (JSON.stringify(newSegs) !== JSON.stringify(this._segments)) {
          this._segments = newSegs;
        }
      }
      this._initialized = true;
    } else if (schedState && (schedState.state === '' || schedState.state === 'unknown' || schedState.state === 'unavailable') && !this._initialized) {
      // Helper exists but is empty, initialize it with current default schedule
      this._initialized = true;
      this._saveSchedule();
    } else if (!schedState && !this._initialized) {
      // If the helper is not found yet, mark initialized to prevent endless loops, but keep defaults
      this._initialized = true;
    }

    // Sync preset + timed-action state (so a running action resumes after a
    // reload, and HA automations can drive it). Respect a short lockout after
    // we write it ourselves, to avoid clobbering an in-flight change.
    const stState = hass.states[this._config.state_entity];
    const timeSinceStateSave = Date.now() - (this._lastStateSaveTime || 0);
    if (stState && typeof stState.state === 'string' && stState.state.startsWith('{') && timeSinceStateSave > 3000) {
      try {
        const s = JSON.parse(stState.state);
        this._preset = (s.preset !== undefined) ? s.preset : this._preset;
        // NOTE: action can be 0 (first action index), so never use `|| null`.
        this._action = (s.action === null || s.action === undefined) ? null : s.action;
        this._actionUntil = Number(s.until) || 0;
        this._returnMode = s.ret || 'Auto';
      } catch (_) { /* ignore malformed state */ }
    }

    // Avoid re-rendering during drag or while a select is open
    // (which would close the dropdown and break interactions).
    if (this._dragging || this._selectOpen) return;

    // HA fires `set hass` very frequently (any entity in the whole instance).
    // Only rebuild the DOM when something this card actually displays changed —
    // otherwise the constant innerHTML rebuild makes the UI flicker.
    const sig = this._renderSignature();
    if (sig === this._lastRenderSig) return;
    this._lastRenderSig = sig;
    this._render();
  }

  // A compact fingerprint of everything the card renders. If it's unchanged
  // since the last render we can safely skip rebuilding the DOM.
  _renderSignature() {
    const pump = this._hass?.states?.[this._config.entity]?.state ?? '?';
    const sched = this._hass?.states?.[this._config.schedule_entity];
    const schedMax = sched?.attributes?.max ?? '?';
    const hasState = this._hass?.states?.[this._config.state_entity] ? '1' : '0';
    const hasMode = this._hass?.states?.[this._config.mode_entity] ? '1' : '0';
    return [
      pump,
      this._mode,
      (this._segments || []).map(s => (s ? '1' : '0')).join(''),
      String(this._action),
      this._actionUntil || 0,
      this._preset || '',
      this._retryState || '',
      schedMax, hasState, hasMode,
    ].join('|');
  }

  static getConfigElement() {
    return document.createElement('pool-timer-card-editor');
  }

  static getStubConfig() {
    return {
      entity: 'switch.pool_pump',
      name: 'Pool Timer',
      schedule_entity: 'input_text.pool_timer_schedule',
      mode_entity: 'input_select.pool_timer_mode',
      state_entity: 'input_text.pool_timer_state',
      quick_actions: DEFAULT_QUICK_ACTIONS,
      presets: DEFAULT_PRESETS,
    };
  }

  getCardSize() {
    return 6;
  }

  connectedCallback() {
    // Update clock every 30s (but never while the user is mid-interaction)
    this._clockInterval = setInterval(() => { if (!this._dragging) this._render(); }, 30000);
    // Evaluate schedule every 60s (and refresh UI for action countdowns/transitions)
    this._scheduleInterval = setInterval(() => {
      // The pump is driven by the Home Assistant blueprint (browser-independent),
      // so the card no longer drives it on a timer — it just refreshes the UI.
      // Explicit user actions still act immediately for a snappy response.
      if (!this._dragging) this._render();
    }, 60000);
    this._render();
  }

  disconnectedCallback() {
    if (this._clockInterval) clearInterval(this._clockInterval);
    if (this._scheduleInterval) clearInterval(this._scheduleInterval);
    if (this._retryTimer) clearTimeout(this._retryTimer);
    if (this._saveDebounce) clearTimeout(this._saveDebounce);
    // Remove the global release listeners bound in _bindEvents.
    window.removeEventListener('pointerup', this._boundPointerUp);
    window.removeEventListener('pointercancel', this._boundPointerUp);
    this._rootEventsBound = false;
  }

  /* ----- default schedule from YAML config ------------------------ */
  _applyDefaultSchedule(ranges) {
    // Only used when no helper data exists yet
    this._segments = new Array(SEGMENT_COUNT).fill(false);
    for (const r of ranges) {
      const [sh, sm] = r.start.split(':').map(Number);
      const [eh, em] = r.end.split(':').map(Number);
      const startIdx = sh * 2 + (sm >= 30 ? 1 : 0);
      let endIdx = eh * 2 + (em >= 30 ? 1 : 0);
      if (endIdx <= startIdx) endIdx += SEGMENT_COUNT;
      for (let i = startIdx; i < endIdx; i++) {
        this._segments[i % SEGMENT_COUNT] = true;
      }
    }
  }

  /* ----- persistence ---------------------------------------------- */
  _loadSchedule() {
    if (!this._hass) return;
    const state = this._hass.states[this._config.schedule_entity];
    if (state && state.state && state.state.length === SEGMENT_COUNT) {
      this._segments = state.state.split('').map(c => c === '1');
    }
  }

  _saveSchedule() {
    if (!this._hass) return;
    const val = this._segments.map(s => (s ? '1' : '0')).join('');
    this._lastSaveTime = Date.now(); // Record last manual change time
    this._hass.callService('input_text', 'set_value', {
      entity_id: this._config.schedule_entity,
      value: val,
    });
  }

  _loadMode() {
    if (!this._hass) return;
    const state = this._hass.states[this._config.mode_entity];
    if (state && state.state) {
      this._mode = state.state;
    }
  }

  _saveMode() {
    if (!this._hass) return;
    this._hass.callService('input_select', 'select_option', {
      entity_id: this._config.mode_entity,
      option: this._mode,
    });
  }

  // Convert a list of {start,end} time ranges into a 48-slot boolean array.
  _rangesToSegments(ranges) {
    const segs = new Array(SEGMENT_COUNT).fill(false);
    for (const r of (ranges || [])) {
      const [sh, sm] = String(r.start).split(':').map(Number);
      const [eh, em] = String(r.end).split(':').map(Number);
      const startIdx = sh * 2 + (sm >= 30 ? 1 : 0);
      let endIdx = eh * 2 + (em >= 30 ? 1 : 0);
      if (endIdx <= startIdx) endIdx += SEGMENT_COUNT;
      for (let i = startIdx; i < endIdx; i++) segs[i % SEGMENT_COUNT] = true;
    }
    return segs;
  }

  // The "after" behavior of the currently running timed action, or null when no
  // numbered action is running. Persisted so a server-side automation can apply
  // the post-action transition (settle / return) WITHOUT knowing the card config
  // — the state helper stays the single, self-describing source of truth.
  _currentAfter() {
    if (typeof this._action === 'number') {
      const a = this._config.quick_actions?.[this._action];
      return a ? (a.after || 'Auto') : null;
    }
    return null;
  }

  // Persist the active preset + any running timed action as JSON in a helper.
  _saveState() {
    if (!this._hass) return;
    this._lastStateSaveTime = Date.now();
    const payload = JSON.stringify({
      preset: this._preset || null,
      // NOTE: _action can be 0 (first action index), so never use `|| null` here.
      action: (this._action === null || this._action === undefined) ? null : this._action,
      until: this._actionUntil || 0,
      ret: this._returnMode || 'Auto',
      // Lets a server-side blueprint enforce timing with the browser closed.
      after: this._currentAfter(),
    });
    this._hass.callService('input_text', 'set_value', {
      entity_id: this._config.state_entity,
      value: payload,
    });
  }

  /* ----- desired-state computation (modes + timed actions) --------
   * Timed actions take priority over the base mode/schedule:
   *  - 'product'    : pump ON until `actionUntil`, then return to `returnMode`.
   *  - 'flocculant' : pump ON until `actionUntil`, then LOCK OFF ('settling')
   *                   so the floc can settle; stays off until the user clears it.
   *  - 'settling'   : pump forced OFF until the user presses "resume".
   * Note: this may mutate state (auto-transitions) and persist it.
   * ---------------------------------------------------------------- */
  _computeDesiredState() {
    const now = Date.now();

    // Check if a timed action is running
    if (typeof this._action === 'number') {
      const action = this._config.quick_actions?.[this._action];
      if (action && now < this._actionUntil) {
        return 'on';                       // action still circulating
      }
      // Action finished (or no longer valid) -> apply its "after" behavior,
      // then FALL THROUGH to the base mode/schedule below. We must never
      // return null here: _evaluateSchedule would then try to drive the pump
      // to `null`, which never matches 'on'/'off' and spams service calls.
      if (action && action.after === 'OFF') {
        this._action = 'settling';         // lock OFF until the user resumes
        this._actionUntil = 0;
        this._saveState();
        return 'off';
      }
      if (action && action.after && action.after !== 'Auto') {
        this._preset = action.after;       // return to a named preset
      }
      this._action = null;
      this._actionUntil = 0;
      this._saveState();
      // fall through
    } else if (this._action === 'settling') {
      return 'off';
    }

    // Base mode.
    if (this._mode === 'Perm') return 'on';
    if (this._mode === 'OFF') return 'off';
    // Auto mode — follow the current 30-min schedule slot.
    const d = new Date();
    const idx = d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0);
    return this._segments[idx] ? 'on' : 'off';
  }

  /* ----- schedule evaluation -------------------------------------- */
  _evaluateSchedule() {
    if (!this._hass) return;
    const entityState = this._hass.states[this._config.entity];
    if (!entityState) return;
    const desiredState = this._computeDesiredState();
    if (entityState.state !== desiredState) {
      this._callServiceWithRetry(desiredState);
    }
  }

  /* ----- retry with exponential backoff --------------------------- */
  _callServiceWithRetry(targetState) {
    // Safety guard: only ever drive the switch to a real on/off state.
    // A null/undefined target would never match and would spam services.
    if (targetState !== 'on' && targetState !== 'off') return;
    this._targetSwitchState = targetState;
    this._retryCount = 0;
    this._retryState = 'retrying';
    this._render();
    this._attemptServiceCall();
  }

  _attemptServiceCall() {
    if (!this._hass) return;
    const service = this._targetSwitchState === 'on' ? 'turn_on' : 'turn_off';
    this._hass.callService('switch', service, {
      entity_id: this._config.entity,
    });

    // Check after delay
    const delay = BASE_DELAY_MS * Math.pow(2, this._retryCount);
    this._retryTimer = setTimeout(() => {
      const current = this._hass.states[this._config.entity];
      if (current && current.state === this._targetSwitchState) {
        // Success
        this._retryState = 'idle';
        this._retryCount = 0;
        this._targetSwitchState = null;
        this._render();
      } else {
        this._retryCount++;
        if (this._retryCount >= MAX_RETRIES) {
          this._retryState = 'failed';
          this._retryCount = 0;
          this._render();
          // Reset after 10s
          setTimeout(() => {
            this._retryState = 'idle';
            this._render();
          }, 10000);
        } else {
          this._attemptServiceCall();
        }
      }
    }, delay);
  }

  /* ----- segment interactions -------------------------------------
   * Robust model: we NEVER rebuild the DOM mid-interaction (that destroys
   * the captured pointer target and loses the pointerup). Instead we paint
   * segments in place, hit-test with elementFromPoint while dragging, catch
   * the release on `window`, and save redundantly (debounced + on release).
   * ---------------------------------------------------------------- */

  // Find the segment index under a given screen coordinate (works regardless
  // of SVG scaling, and across the whole drag even with pointer capture).
  _segmentIndexAt(clientX, clientY) {
    const el = this.shadowRoot.elementFromPoint(clientX, clientY);
    const seg = el && el.closest ? el.closest('.seg') : null;
    if (!seg || seg.dataset.idx == null) return -1;
    return parseInt(seg.dataset.idx, 10);
  }

  // Update a segment's state + its visual, in place (no full re-render).
  _applySegment(idx, value) {
    if (idx < 0 || idx >= SEGMENT_COUNT) return;
    this._segments[idx] = value;
    const seg = this.shadowRoot.querySelector(`.seg[data-idx="${idx}"]`);
    if (seg) {
      seg.setAttribute('fill', value ? COLORS.segOn : COLORS.segOff);
      seg.setAttribute('stroke', value ? COLORS.segOnStroke : COLORS.segOffStroke);
      seg.classList.toggle('seg--on', value);
      seg.classList.toggle('seg--off', !value);
    }
  }

  // Persist redundantly while editing so a single tap survives even if the
  // pointerup is ever missed. Debounced to avoid spamming the HA service.
  _scheduleSave() {
    this._lastSaveTime = Date.now();
    if (this._saveDebounce) clearTimeout(this._saveDebounce);
    this._saveDebounce = setTimeout(() => {
      this._saveDebounce = null;
      this._saveSchedule();
    }, 350);
  }

  _onDialPointerDown(e) {
    const seg = e.target && e.target.closest ? e.target.closest('.seg') : null;
    if (!seg || seg.dataset.idx == null) return;
    e.preventDefault();
    // Release the implicit pointer capture so pointermove can hit-test OTHER
    // segments during a drag (otherwise all events stay on this one element).
    if (e.pointerId != null && seg.releasePointerCapture) {
      try { seg.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    const idx = parseInt(seg.dataset.idx, 10);
    this._dragging = true;
    this._dragValue = !this._segments[idx];
    this._lastSaveTime = Date.now();
    this._applySegment(idx, this._dragValue);
    this._scheduleSave();
  }

  _onDialPointerMove(e) {
    if (!this._dragging) return;
    e.preventDefault();
    const idx = this._segmentIndexAt(e.clientX, e.clientY);
    if (idx >= 0 && this._segments[idx] !== this._dragValue) {
      this._applySegment(idx, this._dragValue);
      this._scheduleSave();
    }
  }

  _onGlobalPointerUp() {
    if (!this._dragging) return;
    this._dragging = false;
    this._dragValue = null;
    if (this._saveDebounce) { clearTimeout(this._saveDebounce); this._saveDebounce = null; }
    // User edited manually → clear preset and mark as Custom
    this._preset = null;
    this._saveSchedule();       // authoritative, immediate write
    this._saveState();          // persist the cleared preset
    this._evaluateSchedule();   // apply the new schedule to the pump now
    this._render();             // safe to fully refresh now the gesture ended
  }

  /* ----- mode / preset / action control --------------------------- */
  _setMode(mode) {
    this._mode = mode;
    // Choosing a base mode clears any temporary action (incl. settling lock).
    this._action = null;
    this._actionUntil = 0;
    this._returnMode = mode;
    this._saveMode();
    this._saveState();
    this._evaluateSchedule();
    this._render();
  }

  // Load a preset's schedule and switch to Auto so it takes effect.
  _selectPreset(name) {
    const preset = (this._config.presets || []).find(p => p.name === name);
    if (!preset) return;
    this._segments = preset.segments
      ? String(preset.segments).split('').map(c => c === '1')
      : this._rangesToSegments(preset.schedule);
    this._preset = name;
    this._mode = 'Auto';
    this._action = null;
    this._actionUntil = 0;
    this._returnMode = 'Auto';
    this._saveSchedule();
    this._saveMode();
    this._saveState();
    this._evaluateSchedule();
    this._render();
  }

  // Start a timed action by index.
  _startAction(actionIdx) {
    if (actionIdx < 0 || actionIdx >= (this._config.quick_actions || []).length) return;
    const action = this._config.quick_actions[actionIdx];
    const hours = action.hours || 2;
    // Remember where to return to, unless we're already inside an action.
    if (!this._action || this._action === 'settling') {
      this._returnMode = this._mode || 'Auto';
    }
    this._action = actionIdx;
    this._actionUntil = Date.now() + hours * 3600 * 1000;
    this._saveState();
    this._evaluateSchedule();
    this._render();
  }

  // Cancel / finish the current action and go back to the previous base mode.
  _clearAction() {
    this._action = null;
    this._actionUntil = 0;
    this._mode = this._returnMode || 'Auto';
    this._saveMode();
    this._saveState();
    this._evaluateSchedule();
    this._render();
  }

  // Execute a corner action (quick toggle, no timer).
  _callCornerAction(actionIdx) {
    const action = this._config.corner_actions?.[actionIdx];
    if (!action || !action.entity_id) return;
    const service = `${action.service}/${action.action}`;
    this._hass?.callService(action.service, action.action, {
      entity_id: action.entity_id,
    });
  }

  // Check if a corner action entity is active (for visual feedback).
  _isCornerActionActive(actionIdx) {
    const action = this._config.corner_actions?.[actionIdx];
    if (!action || !action.entity_id || !this._hass) return false;
    const entityState = this._hass.states?.[action.entity_id];
    return entityState?.state === 'on';
  }

  /* ----- one-click helper auto-setup ------------------------------
   * Detects missing helpers (and a too-small schedule `max`) and can create /
   * fix them via the HA WebSocket collection API — the same calls the built-in
   * Helpers UI uses. Only admins can do this; others get an instruction note.
   * ---------------------------------------------------------------- */
  _helperDefs() {
    const titleize = (id) => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const zeros = new Array(SEGMENT_COUNT).fill('0').join('');
    const defs = [];
    const sched = this._config.schedule_entity;
    if (sched && sched.startsWith('input_text.')) {
      defs.push({ entity: sched, domain: 'input_text',
        create: { name: titleize(sched.split('.')[1]), min: 0, max: 255, initial: zeros, mode: 'text' } });
    }
    const mode = this._config.mode_entity;
    if (mode && mode.startsWith('input_select.')) {
      defs.push({ entity: mode, domain: 'input_select',
        create: { name: titleize(mode.split('.')[1]), options: ['Auto', 'Perm', 'OFF'], initial: 'Auto' } });
    }
    const st = this._config.state_entity;
    if (st && st.startsWith('input_text.')) {
      defs.push({ entity: st, domain: 'input_text',
        create: { name: titleize(st.split('.')[1]), min: 0, max: 255, initial: '', mode: 'text' } });
    }
    return defs;
  }

  _setupIssues() {
    if (!this._hass) return { missing: [], maxTooSmall: false, canFix: false };
    const missing = this._helperDefs().filter(d => !this._hass.states[d.entity]);
    const sched = this._hass.states[this._config.schedule_entity];
    const schedMax = sched ? Number(sched.attributes && sched.attributes.max) : NaN;
    const maxTooSmall = !!(sched && schedMax > 0 && schedMax < SEGMENT_COUNT);
    const canFix = !!(this._hass.user && this._hass.user.is_admin);
    return { missing, maxTooSmall, canFix };
  }

  async _runSetup() {
    if (!this._hass || this._setupBusy) return;
    const { missing, maxTooSmall, canFix } = this._setupIssues();
    if (!canFix) return;
    this._setupBusy = true;
    this._setupError = null;
    this._render();
    try {
      // Create any missing helpers.
      for (const d of missing) {
        await this._hass.callWS({ type: `${d.domain}/create`, ...d.create });
      }
      // Fix the schedule helper's max length if it's below 48.
      if (maxTooSmall) {
        const list = await this._hass.callWS({ type: 'input_text/list' });
        const objId = this._config.schedule_entity.split('.')[1];
        const item = (list || []).find(i => i.id === objId);
        if (item) {
          await this._hass.callWS({
            type: 'input_text/update',
            input_text_id: item.id,
            name: item.name,
            min: 0,
            max: 255,
            mode: item.mode || 'text',
            pattern: item.pattern || null,
            initial: item.initial || null,
          });
        }
      }
    } catch (e) {
      this._setupError = String((e && e.message) ? e.message : e);
      console.error('[pool-timer-card] auto-setup failed:', e);
    } finally {
      this._setupBusy = false;
      this._render();
    }
  }

  /* ----- next change calculation ---------------------------------- */
  _getNextChange() {
    const now = new Date();
    const currentIdx = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
    const currentState = this._segments[currentIdx];

    for (let offset = 1; offset <= SEGMENT_COUNT; offset++) {
      const idx = (currentIdx + offset) % SEGMENT_COUNT;
      if (this._segments[idx] !== currentState) {
        const hour = Math.floor(idx / 2);
        const min = (idx % 2) * 30;
        return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      }
    }
    return null;
  }

  /* ----- render --------------------------------------------------- */
  _render() {
    if (!this.shadowRoot) return;
    const lang = this._lang;
    const entityState = this._hass?.states[this._config.entity];
    const pumpOn = entityState?.state === 'on';
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const needleAngle = ((hours * 60 + minutes) / 1440) * 360;
    const nextChange = this._mode === 'Auto' ? this._getNextChange() : null;
    const cardName = this._config.name || t('title_default', lang);

    // LED color
    let ledColor = pumpOn ? COLORS.ledOn : COLORS.ledOff;
    let ledClass = 'led';
    if (this._retryState === 'retrying') {
      ledColor = COLORS.ledRetry;
      ledClass = 'led led--retrying';
    } else if (this._retryState === 'failed') {
      ledColor = COLORS.ledOff;
      ledClass = 'led led--failed';
    }

    // Build segments SVG
    let segmentsSVG = '';
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const startDeg = (i / SEGMENT_COUNT) * 360;
      const endDeg = ((i + 1) / SEGMENT_COUNT) * 360;
      const d = segmentArc(CX, CY, R_SEG_OUTER, R_SEG_INNER, startDeg, endDeg);
      const on = this._segments[i];
      const fill = on ? COLORS.segOn : COLORS.segOff;
      const stroke = on ? COLORS.segOnStroke : COLORS.segOffStroke;
      segmentsSVG += `<path class="seg ${on ? 'seg--on' : 'seg--off'}" d="${d}"
        fill="${fill}" stroke="${stroke}" stroke-width="0.5"
        data-idx="${i}" />`;
    }

    // Numbers ring background
    const numRingBgInner = R_SEG_INNER - 2;
    const numRingBgOuter = R_SEG_INNER;

    // Hour numbers + ticks
    let numbersSVG = '';
    for (let h = 0; h < 24; h++) {
      const angle = (h / 24) * 360;
      // Hour number
      const pos = polarToXY(CX, CY, R_NUM_RING, angle);
      const displayNum = h === 0 ? '24' : String(h);
      numbersSVG += `<text x="${pos.x}" y="${pos.y}" class="hour-num"
        text-anchor="middle" dominant-baseline="central"
        transform="rotate(${angle}, ${pos.x}, ${pos.y})">${displayNum}</text>`;

      // Major tick
      const t1 = polarToXY(CX, CY, R_TICK_OUTER, angle);
      const t2 = polarToXY(CX, CY, R_TICK_INNER, angle);
      numbersSVG += `<line x1="${t1.x}" y1="${t1.y}" x2="${t2.x}" y2="${t2.y}"
        stroke="${COLORS.numText}" stroke-width="1.2" />`;

      // Minor tick (at half hour)
      const halfAngle = angle + (1 / 48) * 360;
      const m1 = polarToXY(CX, CY, R_TICK_OUTER, halfAngle);
      const m2 = polarToXY(CX, CY, R_TICK_INNER + 3, halfAngle);
      numbersSVG += `<line x1="${m1.x}" y1="${m1.y}" x2="${m2.x}" y2="${m2.y}"
        stroke="${COLORS.numText}" stroke-width="0.6" opacity="0.5" />`;
    }

    // Needle
    const needleTip = polarToXY(CX, CY, R_NEEDLE, needleAngle);
    const needleTail = polarToXY(CX, CY, 15, needleAngle + 180);

    // Knob ridges
    let knobRidges = '';
    for (let i = 0; i < 36; i++) {
      const a = i * 10;
      const p1 = polarToXY(CX, CY, R_KNOB - 2, a);
      const p2 = polarToXY(CX, CY, R_KNOB - 8, a);
      knobRidges += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"
        stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-linecap="round"/>`;
    }

    // Status text
    let statusText = pumpOn ? t('pump_on', lang) : t('pump_off', lang);
    if (this._retryState === 'retrying') statusText = t('retrying', lang);
    if (this._retryState === 'failed') statusText = t('retry_failed', lang);

    let nextChangeText = '';
    if (nextChange && this._mode === 'Auto') {
      nextChangeText = `${t('next_change', lang)} ${t('at', lang)} ${nextChange}`;
    } else if (this._mode !== 'Auto') {
      nextChangeText = '';
    } else {
      nextChangeText = t('no_change', lang);
    }
    // While a timed action overrides the schedule, the "next change" hint is misleading.
    // (_action can be 0 — the first action — so check against null explicitly.)
    if (this._action != null) nextChangeText = '';

    /* ---- helper auto-setup banner ---- */
    const issues = this._setupIssues();
    let setupHTML = '';
    if (issues.missing.length > 0 || issues.maxTooSmall) {
      const msg = issues.missing.length > 0 ? t('setup_missing', lang) : t('setup_max_issue', lang);
      const btnLabel = this._setupBusy
        ? t('setup_busy', lang)
        : (issues.missing.length > 0 ? t('setup_create', lang) : t('setup_fix', lang));
      const action = issues.canFix
        ? `<button class="chip setup-btn" ${this._setupBusy ? 'disabled' : ''}>${btnLabel}</button>`
        : `<span class="setup-note">${t('setup_admin_only', lang)}</span>`;
      const err = this._setupError ? `<div class="setup-err">${t('setup_error', lang)}</div>` : '';
      setupHTML = `
        <div class="setup-banner">
          <div class="setup-row">
            <span class="setup-txt">⚠️ <b>${t('setup_title', lang)}:</b> ${msg}</span>
            ${action}
          </div>
          ${err}
        </div>`;
    }

    /* ---- presets, quick actions & action banner ---- */
    const presets = this._config.presets || [];
    const hasPresets = presets.length > 0;
    const quickActions = this._config.quick_actions || [];
    const hasActions = quickActions.length > 0;

    const presetsHTML = hasPresets
      ? `<select class="preset-select" data-select="preset">
          <option value="">Custom</option>
          ${presets.map(p =>
            `<option value="${p.name}" ${this._preset === p.name ? 'selected' : ''}>${p.name}</option>`
          ).join('')}
        </select>`
      : '';

    const fmtRemaining = (ms) => {
      const mins = Math.max(0, Math.round(ms / 60000));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
    };

    const actionsHTML = hasActions
      ? quickActions.map((action, idx) => {
          const label = action.name ? `${action.icon} ${action.name}` : action.icon;
          return `<button class="chip action-btn ${this._action === idx ? 'chip--warn-active' : ''}" data-action-idx="${idx}" title="${action.name || action.icon}">${label}</button>`;
        }).join('')
      : '';

    /* ---- mode selector: dropdown if presets, buttons if not ---- */
    const modeHTML = hasPresets
      ? `<select class="mode-select" data-select="mode">
          <option value="Auto" ${this._mode === 'Auto' ? 'selected' : ''}>${t('mode_auto', lang)}</option>
          <option value="Perm" ${this._mode === 'Perm' ? 'selected' : ''}>${t('mode_perm', lang)}</option>
          <option value="OFF" ${this._mode === 'OFF' ? 'selected' : ''}>${t('mode_off', lang)}</option>
        </select>`
      : `<div class="mode-bar">
          <button class="mode-btn ${this._mode === 'Auto' && !this._action ? 'mode-btn--active' : ''}"
            data-mode="Auto">${t('mode_auto', lang)}</button>
          <button class="mode-btn ${this._mode === 'Perm' && !this._action ? 'mode-btn--active' : ''}"
            data-mode="Perm">${t('mode_perm', lang)}</button>
          <button class="mode-btn ${this._mode === 'OFF' && !this._action ? 'mode-btn--active' : ''}"
            data-mode="OFF">${t('mode_off', lang)}</button>
        </div>`;

    let bannerHTML = '';
    if (typeof this._action === 'number' && quickActions[this._action]) {
      const action = quickActions[this._action];
      const remaining = fmtRemaining(this._actionUntil - Date.now());
      const isFlocculant = action.after === 'OFF';
      const label = `${action.icon} ${action.name}: ${isFlocculant ? 'running' : 'active'}`;
      const retTxt = !isFlocculant ? ` · ${t('returns_to', lang)} ${action.after}` : '';
      bannerHTML = `
        <div class="banner banner--running">
          <span class="banner-txt">⏳ ${label} · ${remaining} ${t('remaining', lang)}${retTxt}</span>
          <button class="chip banner-btn" data-banner="cancel">${t('cancel', lang)}</button>
        </div>`;
    } else if (this._action === 'settling') {
      bannerHTML = `
        <div class="banner banner--settling">
          <span class="banner-txt">🧽 ${t('flocculant_settling', lang)}</span>
          <button class="chip banner-btn" data-banner="resume">${t('resume', lang)}</button>
        </div>`;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --card-bg: ${COLORS.cardBg};
        }
        .card {
          background: var(--card-bg);
          border-radius: 16px;
          padding: 20px 16px 16px;
          border: 1px solid ${COLORS.border};
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
          font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .title {
          font-size: 18px;
          font-weight: 600;
          color: ${COLORS.textPrimary};
          letter-spacing: 0.5px;
        }
        .led-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .led {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${ledColor};
          box-shadow: 0 0 8px 2px ${ledColor}88;
          animation: pulse 2s ease-in-out infinite;
        }
        .led--retrying {
          animation: blink-retry 0.8s ease-in-out infinite;
        }
        .led--failed {
          animation: blink-fail 0.3s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px 2px ${ledColor}88; }
          50% { opacity: 0.7; box-shadow: 0 0 4px 1px ${ledColor}44; }
        }
        @keyframes blink-retry {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes blink-fail {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.1; }
        }
        .led-label {
          font-size: 12px;
          color: ${COLORS.textSecondary};
          font-weight: 500;
        }

        /* Dial container + corner actions */
        .dial-container {
          position: relative;
          width: 100%;
          max-width: 380px;
          margin: 0 auto;
          aspect-ratio: 1;
        }
        .dial-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* Corner action buttons */
        .corner-actions {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          pointer-events: none;
        }
        .corner-btn {
          position: absolute;
          width: 44px;
          height: 44px;
          border: none;
          background: none;
          color: ${COLORS.textPrimary};
          font-size: 28px;
          cursor: pointer;
          pointer-events: all;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }
        .corner-btn:hover {
          transform: scale(1.15);
          filter: drop-shadow(0 2px 6px rgba(74,144,217,0.5));
        }
        .corner-btn:active {
          transform: scale(0.85);
        }
        .corner-btn--active {
          color: ${COLORS.ledOn};
          filter: drop-shadow(0 0 8px ${COLORS.ledOn});
        }
        .corner-btn--active:hover {
          filter: drop-shadow(0 0 12px ${COLORS.ledOn});
        }
        .corner-tl { top: -8px; left: -8px; }
        .corner-tr { top: -8px; right: -8px; }
        .corner-bl { bottom: -8px; left: -8px; }
        .corner-br { bottom: -8px; right: -8px; }

        /* Segments */
        .seg {
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.1s ease;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
        }
        .seg--on {
          filter: drop-shadow(0 2px 4px rgba(74,144,217,0.4));
        }
        .seg:hover {
          filter: drop-shadow(0 2px 6px rgba(107,176,240,0.6)) brightness(1.15);
        }

        /* Hour numbers */
        .hour-num {
          font-size: 14px;
          font-weight: 700;
          fill: ${COLORS.numText};
          font-family: 'Segoe UI', 'Roboto', sans-serif;
        }

        /* Number ring bg */
        .num-ring-bg {
          fill: ${COLORS.numBg};
          opacity: 0.95;
        }

        /* Needle */
        .needle-line {
          stroke: ${COLORS.needle};
          stroke-width: 2;
          stroke-linecap: round;
          filter: drop-shadow(0 0 3px ${COLORS.needle}88);
        }
        .needle-dot {
          fill: ${COLORS.needle};
          filter: drop-shadow(0 0 3px ${COLORS.needle}88);
        }

        /* Knob */
        .knob-outer {
          fill: url(#knob-gradient);
          stroke: rgba(255,255,255,0.1);
          stroke-width: 1;
        }
        .knob-inner {
          fill: url(#knob-inner-gradient);
        }

        /* Mode selector — buttons */
        .mode-bar {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
        }
        .mode-btn {
          padding: 8px 20px;
          border-radius: 10px;
          border: 1.5px solid ${COLORS.border};
          background: ${COLORS.modeInactive};
          color: ${COLORS.textSecondary};
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.3px;
        }
        .mode-btn:hover {
          background: #4A4A4E;
        }
        .mode-btn--active {
          background: ${COLORS.modeActive};
          color: #fff;
          border-color: ${COLORS.segOnStroke};
          box-shadow: 0 2px 12px rgba(74,144,217,0.3);
        }

        /* Mode selector — dropdown */
        .mode-select {
          display: inline-block;
          width: auto;
          min-width: 90px;
          padding: 7px 12px;
          border-radius: 8px;
          border: 1.5px solid ${COLORS.border};
          background: ${COLORS.modeInactive};
          color: ${COLORS.textPrimary};
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .mode-select:hover {
          background: #4A4A4E;
        }
        .mode-select:focus {
          outline: none;
          border-color: ${COLORS.segOnStroke};
          box-shadow: 0 2px 12px rgba(74,144,217,0.3);
        }
        .mode-select option {
          background: #2c2c2e;
          color: ${COLORS.textPrimary};
        }

        /* Preset selector — dropdown */
        .preset-select {
          display: inline-block;
          width: auto;
          min-width: 100px;
          padding: 7px 12px;
          border-radius: 8px;
          border: 1.5px solid ${COLORS.border};
          background: ${COLORS.modeInactive};
          color: ${COLORS.textPrimary};
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .preset-select:hover {
          background: #4A4A4E;
        }
        .preset-select:focus {
          outline: none;
          border-color: ${COLORS.segOnStroke};
          box-shadow: 0 2px 12px rgba(74,144,217,0.3);
        }
        .preset-select option {
          background: #2c2c2e;
          color: ${COLORS.textPrimary};
        }

        /* Info panel */
        .info {
          text-align: center;
          margin-top: 12px;
        }
        .header-center {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .info-time {
          font-size: 16px;
          font-weight: 500;
          color: ${COLORS.textSecondary};
          letter-spacing: 1px;
          font-variant-numeric: tabular-nums;
          margin-top: 2px;
        }
        .info-next {
          font-size: 11px;
          color: ${COLORS.textSecondary};
          margin-top: 2px;
        }

        /* Presets & quick actions */
        .section-label {
          text-align: center;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: ${COLORS.textSecondary};
          margin: 14px 0 6px;
          opacity: 0.7;
        }
        .controls-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 14px;
          margin-bottom: 12px;
        }
        .chip-bar {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
        }
        .chip {
          padding: 7px 14px;
          border-radius: 9px;
          border: 1.5px solid ${COLORS.border};
          background: ${COLORS.modeInactive};
          color: ${COLORS.textSecondary};
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .chip:hover {
          background: #4A4A4E;
        }
        .chip--active {
          background: ${COLORS.modeActive};
          color: #fff;
          border-color: ${COLORS.segOnStroke};
          box-shadow: 0 2px 12px rgba(74,144,217,0.3);
        }
        .chip--warn-active {
          background: ${COLORS.ledRetry};
          color: #1C1C1E;
          border-color: ${COLORS.ledRetry};
          box-shadow: 0 2px 12px rgba(255,149,0,0.35);
        }

        /* Action banner */
        .banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 14px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.3;
        }
        .banner--running {
          background: rgba(255,149,0,0.12);
          border: 1px solid ${COLORS.ledRetry};
          color: ${COLORS.textPrimary};
        }
        .banner--settling {
          background: rgba(74,144,217,0.12);
          border: 1px solid ${COLORS.segOnStroke};
          color: ${COLORS.textPrimary};
        }
        .banner-txt { flex: 1; }
        .banner-btn { white-space: nowrap; }

        /* Setup banner */
        .setup-banner {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(255,59,48,0.10);
          border: 1px solid ${COLORS.ledOff};
          font-size: 13px;
          line-height: 1.35;
          color: ${COLORS.textPrimary};
        }
        .setup-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .setup-txt { flex: 1; }
        .setup-note {
          font-size: 12px;
          color: ${COLORS.textSecondary};
          white-space: nowrap;
        }
        .setup-btn { white-space: nowrap; }
        .setup-btn[disabled] { opacity: 0.6; cursor: default; }
        .setup-err {
          margin-top: 6px;
          font-size: 12px;
          color: ${COLORS.ledOff};
        }
      </style>
      <ha-card>
        <div class="card">
          ${setupHTML}
          <div class="header">
            <div class="header-left" style="width: 33%;">
              <span class="title">${cardName}</span>
            </div>
            <div class="header-center" style="width: 34%; text-align: center;">
              <div class="info-time">${timeStr}</div>
            </div>
            <div class="header-right" style="width: 33%; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
              <span class="led-label">${statusText}</span>
              <div class="${ledClass}"></div>
            </div>
          </div>

          <div class="dial-container">
            <svg class="dial-svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="knob-gradient" cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stop-color="#8E8E93"/>
                  <stop offset="100%" stop-color="#48484A"/>
                </radialGradient>
                <radialGradient id="knob-inner-gradient" cx="45%" cy="40%" r="50%">
                  <stop offset="0%" stop-color="#6E6E73"/>
                  <stop offset="100%" stop-color="#3A3A3C"/>
                </radialGradient>
                <filter id="seg-shadow">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.35"/>
                </filter>
              </defs>

              <!-- Number ring background -->
              <circle cx="${CX}" cy="${CY}" r="${R_SEG_INNER - 1}" class="num-ring-bg"/>

              <!-- Segments -->
              <g class="segments-group">
                ${segmentsSVG}
              </g>

              <!-- Ticks and numbers -->
              ${numbersSVG}

              <!-- Knob -->
              <circle cx="${CX}" cy="${CY}" r="${R_KNOB}" class="knob-outer"/>
              <circle cx="${CX}" cy="${CY}" r="${R_KNOB - 10}" class="knob-inner"/>
              ${knobRidges}

              <!-- Needle -->
              <line x1="${needleTail.x}" y1="${needleTail.y}"
                    x2="${needleTip.x}" y2="${needleTip.y}"
                    class="needle-line"/>
              <circle cx="${CX}" cy="${CY}" r="5" class="needle-dot"/>
            </svg>
            <div class="corner-actions">
              ${(this._config.corner_actions || []).map((action, idx) => {
                if (!action.position) return '';  // Skip actions without a position
                const cornerClass = `corner-${action.position}`;
                const isActive = this._isCornerActionActive(idx);
                const activeClass = isActive ? 'corner-btn--active' : '';
                return `<button class="corner-btn ${cornerClass} ${activeClass}" data-corner-idx="${idx}" title="${action.name}">${action.icon}</button>`;
              }).join('')}
            </div>
          </div>

          <div class="info">
            ${nextChangeText ? `<div class="info-next">${nextChangeText}</div>` : ''}
          </div>

          <div class="controls-row">
            ${modeHTML}
            ${presetsHTML}
            ${actionsHTML ? `<div class="chip-bar">${actionsHTML}</div>` : ''}
          </div>

          ${bannerHTML}
        </div>
      </ha-card>
    `;

    // Bind events after innerHTML
    this._bindEvents();

    // Keep the render fingerprint in sync so a direct _render() (e.g. from a
    // button click) doesn't trigger a redundant rebuild on the next set hass().
    if (this._hass) this._lastRenderSig = this._renderSignature();
  }

  /* ----- event binding -------------------------------------------- */
  _bindEvents() {
    const root = this.shadowRoot;
    if (!root) return;

    // Mode selector: buttons OR dropdown (recreated on every render)
    const modeSelect = root.querySelector('.mode-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this._setMode(e.currentTarget.value);
      });
      // Prevent re-renders while the dropdown is open
      modeSelect.addEventListener('focus', () => { this._selectOpen = true; });
      modeSelect.addEventListener('blur', () => { this._selectOpen = false; });
    }
    root.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._setMode(e.currentTarget.dataset.mode);
      });
    });

    // Preset selector dropdown
    const presetSelect = root.querySelector('.preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const value = e.currentTarget.value;
        if (value) {
          this._selectPreset(value);
        } else {
          // "Custom" selected — clear the preset, stay in edit mode
          this._preset = null;
          this._saveState();
          this._render();
        }
      });
      // Prevent re-renders while the dropdown is open
      presetSelect.addEventListener('focus', () => { this._selectOpen = true; });
      presetSelect.addEventListener('blur', () => { this._selectOpen = false; });
    }

    // Quick-action buttons (timed)
    root.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.actionIdx, 10);
        this._startAction(idx);
      });
    });

    // Corner action buttons (quick toggle, no timer)
    root.querySelectorAll('.corner-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.cornerIdx, 10);
        this._callCornerAction(idx);
      });
    });

    // Banner buttons (cancel a running action / resume after settling)
    root.querySelectorAll('.banner-btn').forEach(btn => {
      btn.addEventListener('click', () => this._clearAction());
    });

    // One-click helper auto-setup
    const setupBtn = root.querySelector('.setup-btn');
    if (setupBtn) setupBtn.addEventListener('click', () => this._runSetup());

    // Pointer handling is bound ONCE on persistent targets (the shadowRoot,
    // which survives innerHTML swaps, and window). Delegation + hit-testing
    // means we don't depend on the per-render segment elements.
    if (!this._rootEventsBound) {
      root.addEventListener('pointerdown', (e) => this._onDialPointerDown(e));
      root.addEventListener('pointermove', (e) => this._onDialPointerMove(e));
      root.addEventListener('contextmenu', (e) => {
        if (e.target && e.target.closest && e.target.closest('.dial-svg')) e.preventDefault();
      });
      // Release on window so we always catch it, even off-card / after a DOM swap.
      window.addEventListener('pointerup', this._boundPointerUp);
      window.addEventListener('pointercancel', this._boundPointerUp);
      this._rootEventsBound = true;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Card Editor                                                        */
/* ------------------------------------------------------------------ */
class PoolTimerCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _updateConfig(updates) {
    this._config = { ...this._config, ...updates };
    const event = new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
    this._render();
  }

  _renderQuickActions() {
    const actions = this._config.quick_actions || DEFAULT_QUICK_ACTIONS;
    const presets = this._config.presets || DEFAULT_PRESETS;
    const header = `
      <div class="list-header action-header">
        <span>Icon · Name</span>
        <span>Hours</span>
        <span>After</span>
        <span></span>
      </div>
    `;
    return header + actions.map((action, idx) => `
      <div class="list-item action-item">
        <div class="name-cell">
          <input type="text" class="action-icon" data-idx="${idx}" value="${action.icon || '⏱️'}"
            placeholder="🌀" maxlength="3" />
          <input type="text" class="action-name" data-idx="${idx}" value="${action.name || ''}"
            placeholder="(icon only)" />
        </div>
        <input type="number" class="action-hours" data-idx="${idx}" value="${action.hours}"
          min="0.5" step="0.5" placeholder="2" />
        <select class="action-after" data-idx="${idx}">
          <option value="OFF" ${action.after === 'OFF' ? 'selected' : ''}>Lock OFF</option>
          <option value="Auto" ${action.after === 'Auto' ? 'selected' : ''}>Auto</option>
          ${presets.map(p =>
            `<option value="${p.name}" ${action.after === p.name ? 'selected' : ''}>${p.name}</option>`
          ).join('')}
        </select>
        <button class="btn-delete" type="button" data-idx="${idx}" tabindex="-1">✕</button>
      </div>
    `).join('');
  }

  _renderPresets() {
    const presets = this._config.presets || DEFAULT_PRESETS;
    const header = `
      <div class="list-header preset-header">
        <span>Name</span>
        <span>Time ranges</span>
        <span></span>
      </div>
    `;
    return header + presets.map((preset, idx) => `
      <div class="list-item preset-item">
        <input type="text" class="preset-name" data-idx="${idx}" value="${preset.name}"
          placeholder="Verano" />
        <input type="text" class="preset-schedule" data-idx="${idx}"
          value="${preset.schedule ? preset.schedule.map(r => r.start + '-' + r.end).join(', ') : ''}"
          placeholder="08:00-13:00, 16:00-20:00" />
        <button class="btn-delete" type="button" data-idx="${idx}" tabindex="-1">✕</button>
      </div>
    `).join('');
  }

  _render() {
    const lang = this._hass?.language || 'en';
    const actions = this._config.quick_actions || DEFAULT_QUICK_ACTIONS;
    const presets = this._config.presets || DEFAULT_PRESETS;

    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .editor {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          font-family: Roboto, sans-serif;
        }
        .section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--primary-text-color, #e5e5e7);
          margin-bottom: 4px;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: var(--secondary-text-color, #8e8e93);
        }
        input, select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #3a3a3c;
          border-radius: 6px;
          background: #2c2c2e;
          color: #e5e5e7;
          font-size: 13px;
        }
        input:focus, select:focus {
          outline: none;
          border-color: #4A90D9;
          box-shadow: 0 0 0 2px rgba(74,144,217,0.2);
        }

        /* Shared 4-column grid: name | hours | after | delete.
           Both the header and each row use the SAME template so they align. */
        .action-header,
        .action-item {
          display: grid;
          grid-template-columns: 1fr 52px 92px 28px;
          gap: 6px;
          align-items: center;
        }
        .preset-header,
        .preset-item {
          display: grid;
          grid-template-columns: 1fr 1.6fr 28px;
          gap: 6px;
          align-items: center;
        }

        .list-header {
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: #8e8e93;
        }
        .list-header span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .list-item {
          padding: 8px;
          background: #3a3a3c;
          border-radius: 6px;
          border: 1px solid #4a4a4c;
        }
        .list-item input,
        .list-item select {
          padding: 6px 8px;
          font-size: 12px;
        }
        /* icon + name share the first column */
        .name-cell {
          display: flex;
          gap: 6px;
          align-items: center;
          min-width: 0;
        }
        .name-cell .action-icon {
          width: 38px;
          flex: 0 0 38px;
          padding: 6px 2px;
          text-align: center;
        }
        .name-cell .action-name { min-width: 0; }
        .btn-delete {
          padding: 6px 0;
          background: #FF3B30;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          transition: opacity 0.2s;
        }
        .btn-delete:hover {
          opacity: 0.8;
        }
        .btn-add {
          padding: 8px 14px;
          background: #4A90D9;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          align-self: flex-start;
          transition: opacity 0.2s;
        }
        .btn-add:hover {
          opacity: 0.9;
        }
      </style>
      <div class="editor">
        <!-- Basic Settings -->
        <div class="section">
          <div class="section-title">Basic</div>
          <label>
            ${t('editor_entity', lang)}
            <input type="text" id="entity" value="${this._config.entity || ''}"
              placeholder="switch.pool_pump" />
          </label>
          <label>
            ${t('editor_name', lang)}
            <input type="text" id="name" value="${this._config.name || ''}"
              placeholder="Pool Timer" />
          </label>
        </div>

        <!-- Helpers -->
        <div class="section">
          <div class="section-title">Helpers</div>
          <label>
            Schedule (input_text)
            <input type="text" id="schedule_entity"
              value="${this._config.schedule_entity || 'input_text.pool_timer_schedule'}" />
          </label>
          <label>
            Mode (input_select)
            <input type="text" id="mode_entity"
              value="${this._config.mode_entity || 'input_select.pool_timer_mode'}" />
          </label>
          <label>
            State (input_text)
            <input type="text" id="state_entity"
              value="${this._config.state_entity || 'input_text.pool_timer_state'}" />
          </label>
        </div>

        <!-- Quick Actions -->
        <div class="section">
          <div class="section-title">Quick Actions</div>
          <div id="actions-list">
            ${this._renderQuickActions()}
          </div>
          <button class="btn-add" id="btn-add-action">+ Add Action</button>
        </div>

        <!-- Presets -->
        <div class="section">
          <div class="section-title">Presets</div>
          <div id="presets-list">
            ${this._renderPresets()}
          </div>
          <button class="btn-add" id="btn-add-preset">+ Add Preset</button>
        </div>
      </div>
    `;

    this._bindEditorEvents();
  }

  _bindEditorEvents() {
    const root = this.shadowRoot;

    // Basic fields
    ['entity', 'name', 'schedule_entity', 'mode_entity', 'state_entity'].forEach(field => {
      const input = root.getElementById(field);
      if (input) {
        input.addEventListener('change', (e) => {
          const updates = { [field]: e.target.value };
          this._updateConfig(updates);
        });
      }
    });

    // Quick Actions - edit
    root.querySelectorAll('.action-name, .action-hours, .action-icon, .action-after').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const actions = [...(this._config.quick_actions || DEFAULT_QUICK_ACTIONS)];
        const fieldMap = { 'action-name': 'name', 'action-hours': 'hours', 'action-icon': 'icon', 'action-after': 'after' };
        const field = fieldMap[e.target.className];
        if (field === 'hours') {
          actions[idx][field] = parseFloat(e.target.value) || 2;
        } else {
          actions[idx][field] = e.target.value;
        }
        this._updateConfig({ quick_actions: actions });
      });
    });

    // Quick Actions - delete (use event delegation on container)
    const actionsList = root.getElementById('actions-list');
    if (actionsList) {
      actionsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete') && e.target.closest('.action-item')) {
          e.stopPropagation();
          const actionIdx = parseInt(e.target.dataset.idx, 10);
          const actions = [...(this._config.quick_actions || DEFAULT_QUICK_ACTIONS)];
          actions.splice(actionIdx, 1);
          this._updateConfig({ quick_actions: actions });
        }
      }, true);  // Use capture phase
    }

    // Quick Actions - add
    const addActionBtn = root.getElementById('btn-add-action');
    if (addActionBtn) {
      addActionBtn.addEventListener('click', () => {
        const actions = [...(this._config.quick_actions || DEFAULT_QUICK_ACTIONS)];
        actions.push({ name: 'New Action', hours: 2, icon: '⏱️', after: 'Auto' });
        this._updateConfig({ quick_actions: actions });
      });
    }

    // Presets - edit
    root.querySelectorAll('.preset-name, .preset-schedule').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const presets = [...(this._config.presets || DEFAULT_PRESETS)];
        if (e.target.className === 'preset-name') {
          presets[idx].name = e.target.value;
        } else {
          // Parse "08:00-13:00, 16:00-20:00" into schedule
          const ranges = e.target.value.split(',').map(r => {
            const [start, end] = r.trim().split('-');
            return { start: start?.trim() || '', end: end?.trim() || '' };
          }).filter(r => r.start && r.end);
          presets[idx].schedule = ranges;
        }
        this._updateConfig({ presets });
      });
    });

    // Presets - delete (use event delegation)
    const presetsList = root.getElementById('presets-list');
    if (presetsList) {
      presetsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete')) {
          e.stopPropagation();
          const idx = parseInt(e.target.dataset.idx, 10);
          const presets = [...(this._config.presets || DEFAULT_PRESETS)];
          presets.splice(idx, 1);
          this._updateConfig({ presets });
        }
      }, true);  // Use capture phase
    }

    // Presets - add
    const addPresetBtn = root.getElementById('btn-add-preset');
    if (addPresetBtn) {
      addPresetBtn.addEventListener('click', () => {
        const presets = [...(this._config.presets || DEFAULT_PRESETS)];
        presets.push({ name: 'New Preset', schedule: [{ start: '10:00', end: '16:00' }] });
        this._updateConfig({ presets });
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Register                                                           */
/* ------------------------------------------------------------------ */
customElements.define('pool-timer-card', PoolTimerCard);
customElements.define('pool-timer-card-editor', PoolTimerCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'pool-timer-card',
  name: 'Pool Timer Card',
  description: 'A skeuomorphic 24-hour mechanical pool timer with presets and quick treatment actions (flocculant / shock).',
  preview: true,
  documentationURL: 'https://github.com/serweck/pool-timer-card',
});

console.info(
  '%c POOL-TIMER-CARD %c v2.8.0 ',
  'background:#4A90D9;color:#fff;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px',
  'background:#1A3A5C;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0'
);
