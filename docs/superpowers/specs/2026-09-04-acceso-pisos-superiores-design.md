# Acceso a pie a los pisos principal y segundo

## Contexto

La sala (`js/geometria.js`, `js/parametros.js`, `js/paseo.js`) modela cuatro
plantas de palcos (`P.pisos` en `parametros.js`): platea (y=0.00), principal
(y=4.10), segundo (y=6.70) y paraíso (y=9.60). Solo la platea tiene un
sistema completo de circulación a pie: antepalco, corredor trasero curvo y
puertas de palco que se abren con la tecla E (`antepalcosPlatea`,
`pasilloCurvoPalcos`, `FALLA.puertas` en `geometria.js`). Las otras tres
plantas solo tienen geometría de palcos (separadores, sillas, antepecho) sin
ningún suelo transitable ni forma de llegar a ellas en modo paseo: son
plataformas flotantes.

Esta spec cubre añadir acceso real a pie a las plantas **principal** y
**segundo** mediante dos escaleras traseras simétricas y replicar en ambas
plantas el sistema de antepalco+corredor+puertas que ya existe en platea.
El paraíso (y=9.60, sin palcos, `piso.palcos:0`) queda fuera de alcance.

**Nota (actualizada tras el brainstorming):** entre el momento de escribir
esta spec y hoy se ha añadido, fuera de este proceso, un sistema distinto
que también da acceso al corredor de platea: dos rampas traseras
(`RAMPAS_TRASERAS` en `parametros.js`) que prolongan los pasillos de
alfombra central del patio hasta la cota del corredor, y un "fondo técnico"
de cinco arcos (`fondoTecnicoPlatea` en `geometria.js`, dos arcos de salida
en los extremos y tres cabinas técnicas centrales) en el muro trasero de la
platea. Este sistema resuelve el acceso **al patio y a platea únicamente**,
en el eje central trasero (x≈±3.4, z≈23-29); no sustituye ni entra en
conflicto con las escaleras traseras de esta spec, que se sitúan en la zona
lateral (x≈18-19, junto a `salidasEscalerasPasillo`) y sirven para subir a
principal y segundo. Los dos planos de la sección "Planos esquemáticos"
reflejan ambos sistemas ya coexistiendo.

## Objetivo y criterio de éxito

Desde el modo paseo, un usuario debe poder: subir las escaleras traseras
desde el corredor de platea, llegar al corredor de la planta principal,
abrir con E cualquiera de sus puertas de palco, seguir subiendo por la
misma escalera hasta la planta segundo, y abrir igualmente sus puertas.
Bajar debe devolver correctamente al nivel inferior. Ninguna de las
superficies existentes (patio, platea, embocadura, escaleras laterales
actuales) cambia de comportamiento.

## Decisiones de diseño (resueltas durante el brainstorming)

- **Ubicación**: dos escaleras simétricas (x negativo/positivo), situadas
  justo más allá de donde hoy termina `salidasEscalerasPasillo` (en torno a
  x≈18.65, pegadas al muro exterior/trasero del corredor de platea),
  subiendo en paralelo al eje Z de la sala.
- **Forma del tramo vertical**: zigzag por planta — un tramo recto, un
  rellano, y un segundo tramo recto en sentido contrario, hasta llegar a la
  altura de la planta. El mismo patrón se repite para subir de principal a
  segundo, arrancando desde el rellano superior del primer zigzag.
- **Alcance del pasillo replicado**: antepalco + corredor + puertas
  interactivas se replican tanto en principal como en segundo (no solo en
  segundo).
- **Enfoque de generalización**: mínimo indispensable (Enfoque A). Las
  funciones que generan antepalco y corredor (`antepalcosPlatea`,
  `pasilloCurvoPalcos`) ya reciben `(plan, ini, fin, nCeldas, yBase)` como
  parámetros — no cambian de forma. Lo que era específico de platea era
  solo el cálculo de qué tramos (`ini/fin`) cubrir; ese cálculo ya existe,
  con otro criterio, para principal (`limiteAutoridadD/I`) y para segundo
  (el anillo completo).

## Arquitectura

### 1. Geometría de las escaleras traseras (`js/geometria.js`, `js/parametros.js`)

Nueva función `escalerasTraseras()`, generada con el mismo patrón por
peldaños que ya usa `escalerasLaterales()` (rectángulos orientados,
comprobación de colisión por tramo). A diferencia de esta última, cada
escalera trasera tiene **dos plantas de zigzag encadenadas**:

- Zigzag 1: desde `ALTURA_PLATEA` (suelo del corredor de platea) hasta
  `P.pisos[1].y` (principal). Tramo A (avanza en +z), rellano, tramo B
  (retrocede en -z, mismo ancho de escalera), llegando al rellano superior
  a la cota de principal.
- Zigzag 2: desde el rellano superior del zigzag 1 hasta `P.pisos[2].y`
  (segundo), con la misma estructura tramo-rellano-tramo.

Los parámetros geométricos (longitud de tramo, nº de peldaños, ancho,
posición X exacta pegada al muro) se añaden como una constante nueva en
`parametros.js`, análoga a `ESCALERAS_LATERALES`, p. ej.
`ESCALERAS_TRASERAS`. Se expone en `FALLA.geo` igual que
`escalerasLaterales` y `alturaEscaleraLateral` hoy.

### 2. Corredor, antepalcos y puertas por planta (`js/geometria.js`)

Rename de las dos funciones compartidas para reflejar que ya no son solo de
platea:
- `antepalcosPlatea` → `antepalcosNivel`
- `pasilloCurvoPalcos` → `pasilloCurvoNivel`

Su firma e implementación no cambian. Lo que cambia es quién las llama:

- **Platea (n=0)**: sigue llamándolas exactamente igual que ahora (con
  `iAlaD/corteD` e `iAlaI/corteI`).
- **Principal (n=1)**: se añaden las mismas llamadas usando los índices que
  ya calcula la rama actual para separar el palco de autoridades
  (`limiteAutoridadD`, `limiteAutoridadI`), en los dos tramos
  `[0, limiteAutoridadD]` y `[limiteAutoridadI, borde.length-1]`.
- **Segundo (n=2)**: se añaden las mismas llamadas en un único tramo
  `[0, borde.length-1]` (hoy `separadoresPalco` ya cubre el anillo completo
  de una sola vez para esta planta, sin hueco central).

Las puertas (`puertasPalco`, `FALLA.puertas`) no cambian de mecanismo: es
una lista plana a la que cada llamada a `antepalcosNivel` añade sus propias
puertas, igual que hoy.

### 3. Suelo multi-planta en el modo paseo (`js/paseo.js`)

Este es el cambio de fondo. Hoy `terrenoAltura(x,z)` asume una sola altura
de suelo válida por cada `(x,z)` — correcto mientras solo existe una planta
transitable (platea). Con principal y segundo también transitables, un
mismo `(x,z)` es válido a tres alturas distintas (una por planta), y no hay
forma de distinguirlas solo por posición: se necesita saber en qué planta
está el jugador.

Se añade un estado `nivelActual` (valores 0, 1, 2) junto a las demás
variables de estado del módulo (`x`, `z`, `pitch`, `yaw`...), inicializado
a 0.

- Las zonas de `escalerasTraseras` (tramos y rellanos) son estrechas y no
  se solapan entre sí ni con las escaleras laterales existentes: se
  resuelven por posición exactamente igual que hace hoy
  `alturaEscaleraLateral`, con una función nueva equivalente (p. ej.
  `alturaEscaleraTrasera(x,z)`), y son las únicas zonas que **cambian**
  `nivelActual` — al entrar en un tramo/rellano se fija `nivelActual` al
  nivel de origen o destino de ese tramo, según el sentido de recorrido, de
  forma continua igual que ya hace `alturaEscaleraLateral` con cada
  peldaño (no hay salto brusco: la altura devuelta interpola peldaño a
  peldaño, y el nivel se define aparte).
- Fuera de cualquier zona de escalera, `terrenoAltura` consulta el plano
  plano correspondiente al `nivelActual` vigente: para nivel 0 seguirá
  usando exactamente la lógica actual (patio con pendiente + `enPlatea`
  para el corredor/antepalco/interior de palco); para nivel 1 y 2 se añade
  una función equivalente a `enPlatea` pero parametrizada por planta —
  reutilizando `piso.dentro` y los mismos retranqueos de antepalco/corredor
  ya usados en platea (-2.0 m / -5.0 m desde `PLAN`) — que junto con
  `piso.y` resuelve la altura de suelo de esa planta.
- `posicionValida` y el bloqueo de puertas (`puertaBloquea`) no cambian de
  mecanismo: siguen consultando `terrenoAltura` y la lista plana de
  puertas; como cada puerta ya lleva su propia posición `(x,z)`, funcionan
  igual sin importar a qué planta pertenezcan.

Fuera de alcance: no se modela caerse desde una planta alta ni colisión de
"vacío" hacia abajo en el hueco central de la sala — el antepecho de cada
palco ya actúa como límite visual/de colisión igual que en platea.

## Componentes y archivos

| Archivo | Cambio |
|---|---|
| `js/parametros.js` | Constante `ESCALERAS_TRASERAS` (posición, tramos, peldaños, rellanos); función `alturaEscaleraTrasera`; función `enNivelPalcos(piso, x, z)` generalizando `enPlatea` para principal/segundo; exposición en `FALLA.geo`. |
| `js/geometria.js` | Nueva `escalerasTraseras()`; rename `antepalcosPlatea`→`antepalcosNivel`, `pasilloCurvoPalcos`→`pasilloCurvoNivel`; llamadas nuevas en las ramas `n===1` y `n===2` de `construir()`; añadir `escena.add(escalerasTraseras())`. |
| `js/paseo.js` | Estado `nivelActual`; `terrenoAltura` consulta la zona de escalera trasera primero y si no, el plano del nivel vigente; sin cambios en `posicionValida` más allá de los ya cubiertos por `terrenoAltura`. |

Ningún material nuevo: se reutilizan `mudejarGeometrico`, `mudejarArcos`,
`alfombraEscalera`, `muro`, `maderaPlatea`, `puertaPalco`, `oro`, etc.

## Testing / verificación

No hay lógica de negocio aislable en tests automatizados (es una escena
three.js dependiente de WebGL). Verificación manual en navegador:

1. Arrancar en modo paseo (ya es el comportamiento por defecto), caminar
   hasta una escalera trasera y subir el primer zigzag: comprobar que la
   cámara sigue la altura de los peldaños sin saltos ni huecos.
2. Al llegar al rellano de principal, comprobar que `nivelActual` pasa a 1
   y que se puede caminar por su corredor sin caer al vacío.
3. Abrir y cerrar con E una puerta de antepalco de principal: mismo
   comportamiento que en platea (aviso de interacción, bloqueo mientras
   está cerrada).
4. Repetir 1-3 para el segundo zigzag y la planta segundo.
5. Bajar completamente por la misma escalera y comprobar que se recupera
   `nivelActual=0` y el suelo de platea/patio responde igual que antes de
   este cambio.
6. Comprobar que las escaleras laterales existentes, el corredor de
   platea y sus puertas siguen funcionando exactamente igual (regresión).

## Planos esquemáticos

Diagramas topológicos (no a escala ni con la curvatura real de la
herradura): sirven para situar unas piezas respecto a otras, no para sacar
medidas. Cotas en metros, tomadas de `parametros.js`/`geometria.js`.

### Vista cenital — planta baja (patio + platea)

```
                              ESCENARIO
                 (embocadura arco rebajado + foso, z<0)
z=0    ═══════════════════════════════════════════════════════════
                    │                            │
          PALCO FRONTAL                   PALCO FRONTAL
          (x≈-9..-11)                     (x≈9..11)
z=1.8  ── ┴─── antepalco / pasillo transversal ───┴ ─────────────
z=3.0   ┌───┐                                          ┌───┐
        │ E │◄─ salida x=18.65    salida x=18.65 ─►│ E │
        │ L │  escalera lateral                      │ L │
        └─┬─┘  (patio→platea, +1.05 m)                └─┬─┘
          │                                              │
          │   NUEVA escalera trasera (zigzag)            │   NUEVA escalera
          │   pegada al muro exterior, x≈18-19           │   trasera (ídem,
          │     rellano 1 → PRINCIPAL (y=4.10)           │   lado espejo)
          │     rellano 2 → SEGUNDO  (y=6.70)            │
          │                                              │
          │            PATIO DE BUTACAS                  │
          │        (21 filas, pendiente 3 cm/m)           │
          │                                              │
          │     ┆pasillo┆  bloque   ┆pasillo┆             │
          │     ┆ x=-3.4┆  central  ┆ x=3.4 ┆             │
          │     ┆       ┆  (9 but.) ┆       ┆             │
z≈23-28.6 │     └─rampa──┘         └──rampa─┘             │
          │        (sube a la cota de platea, y≈1.22)     │
z=29.4 ───┴───┬────────┬────────┬────────┬────────┬───────┴──────
          │arco│ │ cabina │ │ cabina │ │ cabina │ │arco│
          │sal.│ │técnica │ │técnica │ │técnica │ │sal.│
          └────┘ └────────┘ └────────┘ └────────┘ └────┘
                  FONDO TÉCNICO (5 arcos, muro trasero de platea,
                  ya construido — fondoTecnicoPlatea())
```

### Vista lateral — sección por una escalera trasera (x≈18-19)

```
y (m)                                                (fuera de alcance)
13.40 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  techo (Abárzuza)

 9.60 ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  paraíso (fuera)
                                                ┌──────────┐
 7.80 ─────────────────────────────────────────┤ SEGUNDO  │ antepecho
                                          ┌─────┤ (y=6.70) │ (6.70+1.10)
 6.70 ──────────────────────────── rellano┘     └──────────┘
                              ╱‾‾ 2º tramo (zigzag "segundo")
                          ╱‾‾
                      ╱‾‾ 1er tramo
 5.25 ─────────────────────────┐                  antepecho
                                │ PRINCIPAL         (4.10+1.15)
 4.10 ─────────────────── rellano  (y=4.10)
                     ╱‾‾ 2º tramo (zigzag "principal")
                 ╱‾‾
             ╱‾‾ 1er tramo, arranca junto al muro exterior
 1.22 ──┴──────────────────────────────────────────────── corredor platea
        (misma cota que llega la rampa trasera del plano cenital)
 0.65 ╲___
         ╲______            patio (pendiente 3 cm/m, sube hacia el fondo)
 0.05        ╲_________________________________
        z=0            z≈24 (última fila)     z≈29.4 (muro trasero)
      (escenario)
```

## Fuera de alcance

- Paraíso (y=9.60): sin palcos, no recibe acceso a pie en esta spec.
- Ascensores, rampas u otro medio de acceso alternativo.
- Caída/colisión de vacío en el hueco central de la sala desde las plantas
  altas (se asume que el antepecho ya delimita correctamente, igual que en
  platea).
