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

/* Default durations (hours) for the quick actions */
const DEFAULT_FLOCCULANT_HOURS = 2;
const DEFAULT_PRODUCT_HOURS = 3;

/* ------------------------------------------------------------------ */
/*  Helper: polar→cartesian                                            */
/* ------------------------------------------------------------------ */
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
    const num = (v, def) => (Number(v) > 0 ? Number(v) : def);
    this._config = {
      name: '',
      ...config,
      entity: config.entity,
      schedule_entity: config.schedule_entity || 'input_text.pool_timer_schedule',
      mode_entity: config.mode_entity || 'input_select.pool_timer_mode',
      // New: persists the active preset + any running timed action (survives reloads)
      state_entity: config.state_entity || 'input_text.pool_timer_state',
      flocculant_hours: num(config.flocculant_hours, DEFAULT_FLOCCULANT_HOURS),
      product_hours: num(config.product_hours, DEFAULT_PRODUCT_HOURS),
      presets: (Array.isArray(config.presets) && config.presets.length)
        ? config.presets
        : DEFAULT_PRESETS,
    };
    // Apply initial schedule from config only if it's the very first setup and we don't have segments loaded
    if (config.schedule && Array.isArray(config.schedule) && !this._initialized) {
      this._applyDefaultSchedule(config.schedule);
    }
  }

  set hass(hass) {
    this._hass = hass;
    // Detect language
    this._lang = (hass.language || hass.locale?.language || 'en');

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
        this._action = s.action || null;
        this._actionUntil = Number(s.until) || 0;
        this._returnMode = s.ret || 'Auto';
      } catch (_) { /* ignore malformed state */ }
    }

    // Avoid re-rendering (and rebuilding the DOM) in the middle of a drag,
    // which would break drag-painting across segments.
    if (!this._dragging) this._render();
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
      flocculant_hours: DEFAULT_FLOCCULANT_HOURS,
      product_hours: DEFAULT_PRODUCT_HOURS,
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
      this._evaluateSchedule();
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

  // Persist the active preset + any running timed action as JSON in a helper.
  _saveState() {
    if (!this._hass) return;
    this._lastStateSaveTime = Date.now();
    const payload = JSON.stringify({
      preset: this._preset || null,
      action: this._action || null,
      until: this._actionUntil || 0,
      ret: this._returnMode || 'Auto',
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

    if (this._action === 'product') {
      if (now < this._actionUntil) return 'on';
      // Treatment finished -> restore the previous base mode.
      this._action = null;
      this._actionUntil = 0;
      this._mode = this._returnMode || 'Auto';
      this._saveMode();
      this._saveState();
    } else if (this._action === 'flocculant') {
      if (now < this._actionUntil) return 'on';
      // Circulation finished -> enter the settling lock (pump stays off).
      this._action = 'settling';
      this._actionUntil = 0;
      this._saveState();
      return 'off';
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

  // Start a timed action ('flocculant' or 'product').
  _startAction(type) {
    const hours = type === 'flocculant'
      ? this._config.flocculant_hours
      : this._config.product_hours;
    // Remember where to return to, unless we're already inside an action.
    if (!this._action || this._action === 'settling') {
      this._returnMode = this._mode || 'Auto';
    }
    this._action = type;
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
    if (this._action) nextChangeText = '';

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
    const flocHours = this._config.flocculant_hours || 0;
    const prodHours = this._config.product_hours || 0;
    const hasActions = flocHours > 0 || prodHours > 0;

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
      ? `
      ${flocHours > 0 ? `<button class="chip action-btn ${this._action === 'flocculant' ? 'chip--warn-active' : ''}" data-action="flocculant">🌀 ${t('flocculant', lang)}</button>` : ''}
      ${prodHours > 0 ? `<button class="chip action-btn ${this._action === 'product' ? 'chip--warn-active' : ''}" data-action="product">🧪 ${t('product', lang)}</button>` : ''}`
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
    if (this._action === 'product' || this._action === 'flocculant') {
      const remaining = fmtRemaining(this._actionUntil - Date.now());
      const label = this._action === 'product' ? t('product_running', lang) : t('flocculant_running', lang);
      const retTxt = this._action === 'product' ? ` · ${t('returns_to', lang)} ${this._returnMode}` : '';
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

        /* Dial container */
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
          transition: all 0.25s ease;
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
          display: block;
          width: auto;
          max-width: 200px;
          margin: 14px auto 0;
          padding: 8px 14px;
          border-radius: 10px;
          border: 1.5px solid ${COLORS.border};
          background: ${COLORS.modeInactive};
          color: ${COLORS.textPrimary};
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
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
          display: block;
          width: 100%;
          max-width: 200px;
          margin: 8px auto 0;
          padding: 8px 14px;
          border-radius: 10px;
          border: 1.5px solid ${COLORS.border};
          background: ${COLORS.modeInactive};
          color: ${COLORS.textPrimary};
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
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
          transition: all 0.2s ease;
        }
        .chip:hover { background: #4A4A4E; }
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
          </div>

          <div class="info">
            ${nextChangeText ? `<div class="info-next">${nextChangeText}</div>` : ''}
          </div>

          ${modeHTML}

          ${presetsHTML ? `
          <div class="section-label">${t('presets', lang)}</div>
          ${presetsHTML}` : ''}

          ${actionsHTML ? `
          <div class="section-label">${t('actions', lang)}</div>
          <div class="chip-bar">${actionsHTML}</div>` : ''}

          ${bannerHTML}
        </div>
      </ha-card>
    `;

    // Bind events after innerHTML
    this._bindEvents();
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
    }

    // Quick-action buttons (flocculant / product)
    root.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._startAction(e.currentTarget.dataset.action);
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

  _render() {
    const lang = this._hass?.language || 'en';
    this.shadowRoot.innerHTML = `
      <style>
        .editor {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 14px;
          color: var(--primary-text-color, #e5e5e7);
        }
        input {
          padding: 8px 12px;
          border: 1px solid #3a3a3c;
          border-radius: 8px;
          background: #2c2c2e;
          color: #e5e5e7;
          font-size: 14px;
        }
        input:focus {
          outline: none;
          border-color: #4A90D9;
        }
      </style>
      <div class="editor">
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
        <label>
          ${t('editor_schedule', lang)}
          <input type="text" id="schedule_entity"
            value="${this._config.schedule_entity || 'input_text.pool_timer_schedule'}" />
        </label>
        <label>
          ${t('editor_mode', lang)}
          <input type="text" id="mode_entity"
            value="${this._config.mode_entity || 'input_select.pool_timer_mode'}" />
        </label>
      </div>
    `;

    // Bind change events
    ['entity', 'name', 'schedule_entity', 'mode_entity'].forEach(field => {
      const input = this.shadowRoot.getElementById(field);
      if (input) {
        input.addEventListener('change', (e) => {
          this._config = { ...this._config, [field]: e.target.value };
          const event = new CustomEvent('config-changed', {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
          });
          this.dispatchEvent(event);
        });
      }
    });
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
  '%c POOL-TIMER-CARD %c v2.3.0 ',
  'background:#4A90D9;color:#fff;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px',
  'background:#1A3A5C;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0'
);
