# Pool Timer - Custom Lovelace Card para Home Assistant

## Referencia Visual

- Temporizador físico de referencia: `temporizador fisico.jpg`

---

## Prompt para Generar el Código

> **Crea una Custom Lovelace Card para Home Assistant** que simule visualmente un **temporizador mecánico analógico de piscina de 24 horas** (tipo reloj programador). La tarjeta debe ser **interactiva, skeuomórfica y premium**, inspirada en un temporizador físico real.

### Descripción Visual Detallada

```
COMPONENTE: Pool Timer Card (tarjeta de temporizador de piscina)
ESTILO: Skeuomórfico moderno sobre fondo oscuro de HA
FORMA: Tarjeta rectangular con un dial circular centrado

ESTRUCTURA DEL DIAL (de exterior a interior):
1. ANILLO EXTERIOR AZUL - 48 segmentos/pestañas clickeables
   - Cada segmento = 30 minutos (48 × 30min = 24h)
   - Segmento ACTIVO (ON): azul brillante (#4A90D9), levantado con sombra 3D
   - Segmento INACTIVO (OFF): azul oscuro (#1A3A5C), plano/hundido
   - Los segmentos se pueden clickear individualmente para toggle ON/OFF
   - También se puede hacer click-and-drag para activar/desactivar rangos

2. ANILLO DE NÚMEROS - Escala de 24 horas
   - Números del 1 al 24 distribuidos en círculo
   - Fondo blanco/crema con tipografía negra
   - Marcas de subdivisión cada 30 minutos entre números
   - El "24" está en la posición superior (12 o'clock)

3. INDICADOR DE HORA ACTUAL
   - Una línea/aguja fina roja que marca la hora actual del sistema
   - Rota automáticamente en tiempo real (360° = 24h)
   - Punto central con la rueda moleteada decorativa

4. CENTRO DEL DIAL
   - Representación visual de la rueda central del timer físico
   - Textura moleteada/estriada circular
   - Efecto 3D con sombreado

ELEMENTOS ADICIONALES EN LA TARJETA:

5. SELECTOR DE MODO (lateral izquierdo o inferior)
   - 3 botones o switch deslizante:
     · "Auto" = Se rige por los segmentos programados
     · "Perm" = Bomba siempre ON (override permanente)
     · "OFF"  = Bomba siempre OFF (override apagado)
   - El modo activo se resalta visualmente

6. INDICADOR DE ESTADO (LED)
   - Punto luminoso tipo LED en la esquina
   - Verde con glow = Bomba encendida
   - Rojo con glow = Bomba apagada
   - Animación de pulso sutil

7. TÍTULO Y INFO
   - "Pool Timer" o nombre configurable en la parte superior
   - Hora actual en formato digital debajo del dial
   - Texto del estado: "Bomba: ON/OFF" y próximo cambio

PALETA DE COLORES:
- Fondo tarjeta: #1C1C1E (gris oscuro HA)
- Anillo exterior ON: #4A90D9 (azul pool)
- Anillo exterior OFF: #1A3A5C (azul oscuro)
- Números: #2C2C2E sobre #F5F5F0
- Aguja hora: #FF3B30 (rojo)
- LED ON: #34C759 (verde)
- LED OFF: #FF3B30 (rojo)
- Modo activo: #4A90D9
- Bordes/carcasa: #3A3A3C
```

### Funcionalidad Requerida

```
INTERACCIÓN CON HOME ASSISTANT:
- Controla una entidad switch.* (la depuradora/bomba de piscina)
- En modo "Auto": enciende/apaga el switch según los segmentos programados
- En modo "Perm": fuerza el switch a ON
- En modo "OFF": fuerza el switch a OFF
- **Mecanismo de Reintento y Validación (Polly-like con Backoff Exponencial):**
  - Al enviar una orden (encender/apagar) mediante el servicio de HA, la tarjeta guarda el estado objetivo deseado.
  - Verifica si el estado de la entidad en `hass.states` coincide con el objetivo.
  - Si no coincide pasados 2 segundos (indica que no se aplicó por lag o fallo de conexión temporal):
    - Inicia un reintento enviando la orden de nuevo.
    - Aplica un retraso con crecimiento exponencial (ej. 2s, 4s, 8s, 16s, 32s... hasta un límite máximo de intentos, ej. 5 veces).
    - Durante esta fase de reintento, el LED de estado puede parpadear en naranja para indicar "Validando/Esperando confirmación".
    - Si se alcanza el límite sin éxito, se muestra un aviso de error visual (LED parpadeando rápido en rojo) y se cancelan los reintentos.

CONFIGURACIÓN YAML:
  type: custom:pool-timer-card
  entity: switch.depuradora_piscina    # Switch de la bomba
  name: "Pool Timer"                    # Nombre personalizable
  schedule:                             # Programación por defecto (opcional)
    - start: "08:00"
      end: "12:00"
    - start: "16:00"
      end: "18:00"

PERSISTENCIA:
- Los segmentos ON/OFF se guardan en un input_text helper de HA
  como string de 96 caracteres (0s y 1s)
- El modo (Auto/Perm/OFF) se guarda en un input_select helper
- La programación persiste entre recargas del dashboard

TIEMPO REAL:
- La aguja de hora actual se actualiza cada minuto
- El estado ON/OFF del switch se refleja inmediatamente
- En modo Auto, evalúa el segmento actual cada minuto
```

---

## Arquitectura Técnica

### Tecnología
- **LitElement** (Web Component) — estándar para tarjetas custom de HA
- **CSS** puro para todo el renderizado visual (sin canvas)
- **SVG** para el dial circular, segmentos y aguja
- **Home Assistant WebSocket API** para comunicación con entidades

### Estructura de Archivos

```
pool-timer-card/
├── pool-timer-card.js          # Componente principal (LitElement + SVG)
├── README.md                   # Documentación e instrucciones de instalación
└── pool-timer-card.yaml        # Ejemplo de configuración
```

> **NOTA:** Todo el código irá en un **único archivo JS** (`pool-timer-card.js`) para facilitar la instalación manual en HA. Se registrará como `custom:pool-timer-card`.

---

## Propuesta de Cambios

### [NEW] pool-timer-card.js

Archivo principal del componente. Contendrá:

1. **Clase `PoolTimerCard`** extiende `LitElement`
   - `setConfig(config)` — Parsea la configuración YAML
   - `set hass(hass)` — Recibe el estado de HA en cada actualización
   - `render()` — Genera el HTML/SVG del temporizador
   - `_renderDial()` — Dibuja el SVG del dial completo
   - `_renderSegments()` — Genera los 96 segmentos azules clickeables
   - `_renderHourMarks()` — Números del 1-24 y marcas de subdivisión
   - `_renderCurrentTimeNeedle()` — Aguja roja de hora actual
   - `_renderCenterKnob()` — Rueda central decorativa
   - `_renderModeSelector()` — Botones Auto/Perm/OFF
   - `_renderStatusLED()` — Indicador LED de estado
   - `_renderInfoPanel()` — Hora digital + estado textual

2. **Lógica de negocio**
   - `_toggleSegment(index)` — Toggle ON/OFF de un segmento individual
   - `_handleDrag(startIndex, endIndex)` — Activar rango de segmentos
   - `_setMode(mode)` — Cambiar modo Auto/Perm/OFF
   - `_evaluateSchedule()` — Determinar si la bomba debería estar ON/OFF según hora actual
   - `_syncWithHA()` — Enviar comandos al switch de HA
   - `_callServiceWithRetry(domain, service, serviceData, targetState)` — Función robusta con lógica Polly / Backoff exponencial para reintentar comandos a HA si el estado no cambia.
   - `_saveSchedule()` — Persistir segmentos en input_text helper
   - `_loadSchedule()` — Cargar segmentos desde input_text helper

3. **Estilos CSS** (en `static get styles()`)
   - Toda la estética skeuomórfica
   - Animaciones de hover en segmentos
   - Glow del LED
   - Transiciones suaves
   - Responsive (se adapta al tamaño de la tarjeta)

4. **Editor de configuración** (clase `PoolTimerCardEditor`)
   - UI para configurar la tarjeta desde el editor visual de HA
   - Selector de entidad switch
   - Campo de nombre
   - Configuración de helpers

### [NEW] README.md

Documentación con:
- Capturas del componente
- Instrucciones de instalación (manual y HACS)
- Configuración YAML completa
- Creación de helpers necesarios (input_text, input_select)

---

## Helpers Necesarios en HA

> **IMPORTANTE:** Antes de usar la tarjeta, se deben crear estos helpers en Home Assistant:

| Helper | Tipo | Propósito |
|--------|------|-----------|
| `input_text.pool_timer_schedule` | input_text (max 48 chars) | Almacena los 48 segmentos como "0" y "1" |
| `input_select.pool_timer_mode` | input_select | Almacena el modo: Auto, Perm, OFF |

---

## Respuestas del Diseño e Integración

1. **Entidad configurable**: La tarjeta requiere definir el `entity` del switch de la bomba de manera dinámica en su configuración YAML (ej: `entity: switch.mi_depuradora`).
2. **Intervalos**: 48 segmentos de **30 minutos** cada uno (más fáciles de pulsar en pantallas táctiles y móviles).
3. **Instalación**: Preparado tanto para instalación manual como compatible con la estructura de repositorios de HACS.
4. **Automatización**: El modo (Auto/Perm/OFF) y el estado se sincronizan con helpers externos en HA, lo que permite que automatizaciones de HA (basadas en temperatura, clima, etc.) modifiquen el comportamiento y la tarjeta se actualice en tiempo real.
5. **Idioma**: Soporte multi-idioma nativo para **Español (es)** e **Inglés (en)**.

---

## Plan de Verificación

### Pruebas Manuales
1. Instalar el JS en `/config/www/pool-timer-card.js` (o vía HACS local)
2. Añadir recurso en Lovelace
3. Crear la tarjeta en el dashboard
4. Verificar:
   - [ ] Los 48 segmentos se renderizan correctamente en círculo (intervalos de 30 min)
   - [ ] Click en segmentos toggle ON/OFF
   - [ ] La aguja roja apunta a la hora actual
   - [ ] Cambio de modo Auto/Perm/OFF funciona
   - [ ] El switch de HA se enciende/apaga según programación
   - [ ] Los segmentos persisten tras recargar la página
   - [ ] Lógica de reintento con backoff exponencial funciona ante fallos de conexión simulados
   - [ ] Se muestra en Español o Inglés según el idioma del perfil de HA
   - [ ] El LED indica correctamente el estado del switch o parpadea en naranja durante reintentos
   - [ ] Responsive: se ve bien en móvil y desktop
