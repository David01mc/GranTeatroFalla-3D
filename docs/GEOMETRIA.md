# Mapa de `js/geometria.js`

Este archivo describe qué parte visible o interactiva del teatro controla cada función. El orden general de carga es:

1. `parametros.js`: planta, alturas, pendientes y colisiones matemáticas.
2. `materiales.js`: texturas y materiales compartidos.
3. `geometria.js`: creación de las mallas y montaje de la escena.
4. `paseo.js`: movimiento, salto, asiento y uso de puertas.

## Primitivas de malla

| Función | Objeto o responsabilidad |
| --- | --- |
| `cinta` | Pared vertical que sigue una polilínea. Se usa en zócalos, muros, frentes y faldones. |
| `banda` | Superficie entre dos polilíneas. Construye suelos, rellanos y cornisas planas. |
| `superficie` | Superficie poligonal general; se usa principalmente para patio y techo. |
| `alfombra` | Cinta texturizada que sigue un eje. La anchura puede ser un número o una función del punto, y la altura se apoya en la rampa posterior donde la hay. |
| `enlaceAlfombra` | Trapecio que une alfombras con orientaciones o anchuras distintas. |
| `remuestreaLinea` | Reparte una polilínea en N puntos equidistantes por longitud de arco. Es lo que permite emparejar dos curvas de distinta densidad en una `banda` sin que los cuadriláteros salgan sesgados. |

## Dimensiones de la sala

`P.patio` fija 18 filas, primera fila en z = 3,80 m, paso de 1 m y 2,50 m desde el extremo posterior del respaldo hasta el frente de la plataforma central de los tres arcos. La medida se toma sobre el eje longitudinal; no hasta el muro situado 2,90 m detrás de ese frente. `respaldoFondo` recoge la extensión posterior de la malla; la variación de giro y escala de las instancias modifica la medida unos 2 mm.

El fondo de la planta queda en z = 26,566 m, el frente de plataforma en 23,666 m, el centro de elipse en 8,855 m y el semieje longitudinal en 17,711 m. Centro y semieje se derivan juntos para conservar la embocadura en z = 0. La anchura y las cotas de los pisos permanecen fijas, incluida la platea a 1,222 m.

Las rampas posteriores y la sala de autoridades del principal se posicionan respecto de `P.fondoSalaZ`. Las filas laterales adaptan su capacidad a la nueva curva, reservando el espacio de plataforma y pasillo; geometría y colisiones utilizan ese mismo reparto. Quedan 360 butacas en el patio y 208 en el anfiteatro del segundo piso.

Comprobación reproducible con el mismo bundle de Three.js r128 que utiliza la aplicación: `node tests/dimensiones.cjs /ruta/three-r128.min.js`. Verifica las filas, separación sobre las mallas, simetría, ausencia de solapes de butacas, cotas de rampas y construcción de la escena.

## Patio de butacas y pasillos

| Función | Objeto o responsabilidad |
| --- | --- |
| `limitesFrontal` | Límites seguros de los dos palcos frontales junto al escenario. |
| `palcosFrontales` | Pareja de palcos enfrentados junto a la boca escénica, en x 9,00–11,50 y z −1,00…1,80. Su frente se abomba 42 cm hacia la sala y queda coronado por `arcoPalcoFrontal`. En planta baja se entra por la puerta del trasdós (`x = ±11,50`) desde un vestíbulo de 3,85 m de ancho en el espacio de servicio. Se llega desde las tablas, bordeando por detrás la embocadura y cruzando un vano de 1,50 m practicado en su ala exterior. El vestíbulo incorpora pavimento, techo, paredes y zócalos texturados; el muro original se abre hasta el techo del primer piso. La conexión con las escaleras queda cerrada. Geometría y paseo comparten la cota de 1,15 m. El palco principal permanece a 4,35 m. |
| `zFila` | Posición longitudinal de una fila del patio. |
| `sitiosCentro` | Coordenadas de las butacas del bloque central. |
| `sitiosLateral` | Coordenadas de las butacas laterales, respetando el pasillo junto al muro. |
| `enBloqueAsientos` | Zona lógica ocupada por las filas; la consulta el modo paseo. |
| `enButacaIndividual` | Colisión del patio, por franjas y no butaca a butaca. Dentro del bloque todo está ocupado salvo el espacio de piernas de cada fila (`PIERNAS_DELANTE`/`PIERNAS_DETRAS`), continuo a lo ancho para llegar al sitio pero separado del de la fila siguiente por el cuerpo de las butacas: no se cambia de fila sin salir al pasillo o saltar. Acotar cada asiento por separado dejaba 12 cm libres entre butacas que, repetidos fila tras fila, formaban pasillos rectos de delante a atrás. |
| `ejeAlfombraPasillo` | Fuente única del eje recto/curvo de cada alfombra longitudinal y rampa posterior. |
| `anchoAlfombraPasillo` | Anchura compartida de la alfombra en cada punto. |
| `bordeAlfombraPasillo` | Vértices exactos de los bordes interior y exterior de la alfombra. Los usan también los suelos contiguos. |
| `pasillosPatio` | Las dos alfombras longitudinales, la transversal y sus enlaces laterales. |
| `perfilRespaldo`, `perfilBrazo`, `geometriaBrazo` | Piezas reutilizables de una butaca. |
| `butacas` | Todas las butacas del patio mediante mallas instanciadas. |

## Escenario y embocadura

| Función | Objeto o responsabilidad |
| --- | --- |
| `perfilArco` | Perfil 2D del arco rebajado de la embocadura. |
| `cintaArcoRebajado` | Molduras concéntricas de la embocadura. |
| `embocadura` | Dintel frontal y alas diagonales hacia los palcos; las pilastras completas giran con las alas. Publica su sección para las colisiones del paseo. |
| `perfilCortina`, `perfilMedioTelon`, `cortina` | Geometría ondulada de cortinas y telón. |
| `juegoTelon` | Bambalinas y patas laterales. |
| `construirTelonFuncional` | Telón principal animado. |
| `suaveT`, `actualizarTelon`, `alternarTelon` | Estado y animación de apertura/cierre del telón. |
| `escenario` | Tarima con borde delantero curvo, faldón de madera, telones y elementos interiores. Alcanza las pilastras, cuyos basamentos nacen sobre las tablas. |
| `sueloFoso` | Foso transitable a −0,90 m con suelo de madera negra, valla curva junto a la alfombra transversal y dos escaleras laterales de 6 peldaños con rellanos y pasamanos. |

## Accesos laterales

| Función | Objeto o responsabilidad |
| --- | --- |
| `escalerasLaterales` | Escalones alfombrados próximos al escenario. |
| `mamparasEscaleras` | Mamparas mudéjares de tres arcos junto al palco 2. |
| `texturaSalida` | Cartel generado para “SALIDA / EXIT”. |
| `salidasEscalerasPasillo` | Rellanos que comunican las escaleras con el corredor posterior. |
| `cajaEscalera` | Caja cuadrada de 9,20 × 9,20 m por ala, con vuelos y rellanos de 3,20 m. Repite tres vuelos por planta: nueve hasta el paraíso. Cada distribuidor comunica la llegada, el siguiente arranque y el corredor de su piso. Las losas superiores tienen 28 cm de canto; los cerramientos y la cubierta alcanzan 2,80 m sobre la última llegada. |

## Palcos de platea

| Función | Objeto o responsabilidad |
| --- | --- |
| `indicesPorLongitud` | Divide un tramo curvo en palcos de longitud semejante. |
| `posteYesoEnIndice` | Separador bajo ondulado entre dos palcos. |
| `separadoresPalco` | Distribuye los separadores de un grupo de palcos. |
| `geometriaBalaustreOrnamental` | Módulo continuo y fino de celosía con octógonos entrelazados, volutas, medallón oval y siete calados; usa una extrusión de 38 mm y bisel ligero para reducir masa y polígonos. |
| `barandillaPalco` | Zócalo, celosía con floritura por ambas caras y pasamanos. La anchura de cada módulo se ajusta al tramo para cerrar las juntas. |
| `tramosPlateaSinSalidas` | Corta una curva en los accesos 1 y 5. |
| `barandillaPlateaConSalidas` | Barandilla de platea dejando libres ambos accesos. |
| `construirSillaPalco`, `sillasPalco` | Sillas simplificadas y distribución dentro de cada palco. |
| `geometriaCortinaPalco` | Hoja recogida de terciopelo de una portada. |
| `columnaMudejar` | Columna completa compartida entre arcos. |
| `portadasPalcosPlatea` | Arcos, paños superiores, dientes, adornos, columnas y cortinas; admite una cota de techo para reutilizar la misma portada en platea y principal. |
| `apliqueEntresuelo` | Aplique volumétrico con textura y microrrelieve de bronce envejecido, dos brazos, globos opalinos y lágrimas colgantes. |
| `apliquesEntresuelo` | Distribuye un aplique bajo cada palco y aplana sus piezas para que el fusionador las reduzca finalmente a una malla de bronce y otra de vidrio. |
| `antepalcosPlatea` | Extensión posterior de 2 m, tabiques y puertas de cada palco. |
| `pasilloCurvoPalcos` | Corredor curvo común situado detrás de los antepalcos. |
| `enNivelPalcos` | Contorno transitable de los pisos elevados; permite conservar la cota principal al abandonar la escalera. |

En el principal, el anillo arranca en `iFrontalD` (primer punto de planta pasada la boca del palco frontal) en vez del índice 0, para dejarle sitio al palco frontal: se recortan contra él antepecho, canto del entresuelo, separadores, sillas, portadas, apliques y antepalcos. El **suelo y el intradós siguen dando la vuelta completa** — recortarlos dejaba cuñas sin suelo entre el palco y el arranque del anillo. El palco se separa 5 mm de ambas superficies para que no peleen por el mismo plano. El corredor trasero tampoco se recorta: va por x≥14,5 y nunca roza el palco.

`adelantaPalcosProscenio()` corrige la planta antes de dibujar nada. Sin él, el anillo arrancaba ya sobre la herradura, en x = 11,14, mientras el frente del palco frontal está en x = 9,00: la valla daba un escalón de 2,14 m justo en la junta entre los dos, con el palco frontal asomado sobre el patio y el palco 2 retranqueado contra el muro.

La función trae el borde interior del principal hasta esa misma línea (`limitesFrontal().xFrente + DESPLAZAMIENTO_FRONTAL_X` = 9,00). Se adelanta **sólo el palco 2**: su frente pasa a ser el del palco frontal y su fondo se queda en el muro, así que gana profundidad hasta 4,15 m. Desde su tabique el borde vuelve a la herradura con un suavizado de pendiente nula al llegar, repartido sobre `PALCOS_VUELTA_PROSCENIO` palcos (hoy 1, el palco 3) y medido sobre el recorrido real de la valla, no por índice. Con 0 el regreso es un ángulo seco y se nota mucho en la celosía vista desde el patio; con 1 el palco 3 hace de embudo y la valla entra en la curva sin quiebro. El corte se toma del mismo reparto por longitud que usa `separadoresPalco()`, no de una distancia aparte, así que el palco 2 llega adelantado exactamente hasta su tabique y no hasta media celda.

Medido sobre la escena en el ala derecha, la valla sale del palco frontal (x 8,58–9,00, con su bombeo de 42 cm), sigue recta en x = 8,98 de z = 2,0 a z = 4,4 —el palco 2— y vuelve a la herradura entre z = 4,8 y z = 7,2: 9,31 · 9,61 · 10,12 · 10,68 · 11,24 · 11,48 · 11,58, donde ya coincide con el trazado original. El mayor desvío entre muestras a 40 cm baja de 1,21 m con el regreso seco a 0,56 m con el actual.

`iFrontalD` se elige sobre la planta, pero el borde interior lo produce `dentro()`, que desplaza cada punto por su normal — y junto a la embocadura esa normal tiene mucha componente en z. Resultado: el primer punto del anillo cae en z = 2,67 mientras el palco frontal termina en z = 1,80. Valla y canto arrancaban ahí y dejaban una **cuña de 87 cm de suelo sin cerrar**, por la que se veía la pared del fondo. `bordeAnillo` recibe un punto de arranque adicional en `Z_CORREDOR_INI`, a la misma x (ese tramo ya es recto), para que empalme con el palco frontal. El suelo no lo necesitaba: `banda()` lo cose desde el contorno completo, que sí pasa por ahí.

El contorno deformado no es el que `dentro(PLAN, piso.dentro)` produce, así que `construir()` se lo pasa a `geo.fijaBordeNivel(1, borde)`: `enNivelPalcos` decide por contorno, no por la geometría dibujada, y sin eso el modo paseo bloquearía un suelo que existe. Comprobado con 525 muestras entre z = 2,2 y z = 12: ningún punto transitable sin suelo debajo.

**Cierre de la caja escénica y remate del muro frontal.** Tarima, fondo y telones no formaban volumen: por encima de la bambalina más alta y por los dos costados se veía el exterior desde el patio. `escenario()` añade dos paños laterales en x = ±9,50 y un techo a y = 12, con el mismo negro (`MAT.hueco`) y la misma medida que el fondo, de la boca (z = 0) al telón de fondo (z = −18,40): a la vista sigue siendo oscuridad, pero ya no hay por dónde escaparse, y queda fuera de la luz del arco (`P.arcoA` = 7,50), así que desde la sala no asoma. `embocadura()` prolonga además el muro frontal 2 m por encima de `P.altura`, retranqueado 40 cm hacia el escenario para que las alas lo tapen: alas y paño del arco terminaban justo en 13,40 y ahí el techo de la sala ya ha despegado, dejando una ranura horizontal.

**Segundo piso: seis palcos y anfiteatro.** Sus veinte palcos de vuelta completa se reducen a **seis por ala** sobre el arco delantero, el más cercano al escenario (2,50 m de frente cada uno, como los 2,49 del principal). El arco trasero entero pasa a ser un **anfiteatro de cuatro filas en cuesta**: la 4, la de arriba, da la vuelta completa; las tres de delante se parten en tres zonas con dos pasillos de 1,20 m, igual que `pasillosPatio()` hace en el patio. Son 246 plazas — 55, 59, 62 y 70 —, y las filas ganan asientos al alejarse del centro porque su arco crece.

El graderío se extiende hacia fuera hasta `ANFI_FUERA` (−2,60), ocupando lo que en los demás pisos es corredor: en los 2,70 m de banda del segundo no caben cuatro filas a 0,80 m de paso, y así quedan 3,20 de filas más 1,50 de pasillo alto. Sobre la fila alta restan 2,05 m hasta la losa del paraíso. Por eso corredor y antepalcos van sólo en el arco de los palcos: por detrás, el pasillo alto hace de distribuidor. Hacen falta dos juegos de índices, porque `uneContornoAPared()` remuestrea `borde` y `planPiso` y sus índices ya no son los de `geo.PLAN`.

Las butacas son las mismas instancias que las del patio: `instanciaButacas()` acepta cota y giro por asiento —el patio los omite— de modo que sumar el graderío no añade una malla por butaca, sólo instancias.

**Todos los niveles llevan la misma valla calada**, a `ALTURA_BARANDILLA` (0,713 m, el tramo recto del separador). El segundo y el paraíso tenían en su lugar un antepecho macizo de granate rematado por una moldura de oro: desde el patio se leían como dos grandes cintas rojas que tapaban la barandilla en vez de dibujarla. Con ellos desaparece también la antigua tapa horizontal del palco, que iba a `yTop` y, con la valla ya en 0,713, flotaba casi medio metro por encima con la textura del techo.

**Cotas de los forjados y altura libre.** El segundo está a 7,10 y el paraíso a 9,90. Antes estaban en 6,70 y 9,60, y con esas cotas el principal se quedaba en **2,35 m libres**, el mínimo de la sala y 53 cm por debajo de los palcos de platea que tiene justo debajo: los 25 cm del entresuelo decorativo salieron de ese hueco al subir su suelo de 4,10 a 4,35. Ahora quedan 2,88 (platea) · 2,75 (principal) · 2,80 (segundo) · 3,50 (paraíso), dentro de los 13,40 de `P.altura`. Los arcos de las portadas del principal cuelgan de `P.pisos[2].y`, así que suben con el forjado: su luz pasa de 2,01 a 2,41 m.

**Circulación vertical.** Las dos cajas repiten la misma distribución desde platea hasta principal (4,35 m), segundo (7,10 m) y paraíso (9,90 m). Un distribuidor de 3,20 m de fondo conecta cada desembarco con el siguiente arranque y con un puente al corredor. Los extremos de los corredores altos se recortan en z = 1,20 m para no cubrir los vuelos; el paraíso recibe también corredor y pavimento de enlace. `alturaCajaEscalera(x,z,yRef)` selecciona la superficie más cercana a los pies entre todos los módulos apilados, y el paseo obtiene el nivel de la lista de cotas, sin limitarlo a dos pisos.

El segundo piso no crea otro palco frontal. `uneContornoAPared` recorta por separado su borde interior y exterior en `z = 1,80 m`. La barandilla nace en la arista interior de la mampara (`x = 9,00 m`) y el suelo alcanza su arista exterior (`x = 11,50 m`). No hay geometría transversal sobre el panel: ambos contornos salen hacia el fondo y recuperan gradualmente su curva original durante los 4,60 m siguientes. Suelo, intradós, barandilla, moldura y separadores comparten este trazado.

## Puertas e interacción

| Función | Objeto o responsabilidad |
| --- | --- |
| `puertaCercana` | Busca la puerta interactiva más próxima. |
| `alternarPuertaCercana` | Cambia el objetivo abierto/cerrado de una puerta. |
| `actualizarPuertas` | Interpola la animación de las hojas. |
| `puertaBloquea` | Colisión simplificada de una puerta cerrada. |
| `alturaAccesoPalcoFrontal` | Cota transitable del corredor posterior y del suelo curvo de los palcos frontales de planta baja. |
| `signoPuerta` | Sentido de apertura según el lado del teatro. |

## Fondo y pisos superiores

| Función | Objeto o responsabilidad |
| --- | --- |
| `palcoAutoridades` | Sala central del piso principal y sus aproximadamente 40 asientos. |
| `fondoTecnicoPlatea` | Rampas posteriores, plataforma de las tres cabinas y fachada curva de cinco arcos. |
| `entresueloDecorativoPrincipal` | Grupo de 25 cm entre la cota inferior histórica (4,10 m) y el suelo principal (4,35 m). El frente visible desde el patio lleva un paño malva entre molduras horizontales, sin la cenefa superior de arquillos; intradós, trasdós y testeros permanecen separados. |
| Corredor principal | Réplica transitable a 4,35 m con huecos de losa para ambas escaleras, pavimento, paredes, antepalcos, valla ornamental, portadas arqueadas y puertas independientes por altura. La antigua tapa oscura, el antepecho macizo y el muro burdeos original quedan abiertos entre 4,35 y 6,70 m; sobre la pared clara se conserva únicamente un velo translúcido de sombra. |
| `texturaTecho` | Carga la pintura del techo. |
| `lampara` | Araña central simplificada. |

## Montaje

`construir(escena)` coordina todos los componentes. Dentro de su rama de platea también crea:

- los dos palcos frontales de platea y los del piso principal;
- la peana y el muro portante;
- el parquet de las alas laterales;
- las terminaciones curvas junto a las alfombras posteriores;
- los pisos principal, segundo y paraíso;
- las luces generales y las luces auxiliares de los palcos frontales.

La API pública queda expuesta como `FALLA.escena.construir`. Las puertas se publican mediante `FALLA.puertas` y el telón mediante `FALLA.telon`.

## Encuentro entre la platea y las alfombras de salida

Es la zona más entrelazada del archivo: valla, suelo, canto y mamparas comparten los mismos puntos, y tocarlos por separado los descuadra.

| Función | Objeto o responsabilidad |
| --- | --- |
| `enHuecoRampa` | Único criterio de «este punto cae dentro del paso de la rampa». Lo consultan la valla, el remate del suelo y las mamparas. |
| `tramosPlateaSinSalidas` | Parte la curva de la barandilla en los dos huecos, cortando el segmento en el punto exacto del borde (por bisección) en vez de descartar vértices enteros. Devuelve además, en sus extremos, los cuatro bordes de hueco que usan las mamparas. |
| `construirMamparaArcos` | Mampara mudéjar parametrizable: ancho, alto libre y número de vanos. Ornamenta ambas caras, porque es una pieza exenta. |
| `mamparasEscaleras` | Dos mamparas de tres vanos en el desembarco de las escaleras laterales, sobre la radial del palco 2. |
| `mamparasRampas` | Cuatro mamparas que separan los palcos de las alfombras, una por flanco de cada rampa. Se resuelven en módulos de un vano tangentes al borde real de la alfombra y se recortan contra el plano tangente del arco de salida, sin invadir el corredor posterior. |

## Constantes de la geometría

| Constante | Qué gobierna |
| --- | --- |
| `ASIENTO_PASO`, `FILA_PASO` | Separación entre butacas de una fila y entre filas. |
| `PASILLO_CENTRAL`, `PASILLO_LATERAL` | Anchura de los pasillos centrales y de los que van junto a los muros. |
| `Z_FILA1` | Profundidad de la primera fila, origen del patio. |
| `FILAS_CENTRO`, `ASIENTOS_CENTRO`, `FILAS_LATERAL`, `ASIENTOS_LATERAL` | Recuento de butacas por bloque; `ASIENTOS_LATERAL` da el número de cada fila. |
| `CENTRO_MEDIO`, `LATERAL_DENTRO` | Semianchura del bloque central y borde interior de los laterales. Derivadas, no se editan sueltas. |
| `SITIOS_BUTACAS` | Lista ya calculada de todas las posiciones de butaca (centro más los dos laterales). Se resuelve una sola vez al cargar y la reutilizan tanto el instanciado de `butacas` como la colisión del modo paseo. |
| `RESERVA_TECNICA_MEDIA` | Semianchura reservada al fondo para los cinco vanos técnicos. Debe superar el borde exterior del último arco, o la última portada de palco lo invade. |
| `ANCHO_FRONTAL`, `DESPLAZAMIENTO_FRONTAL_X` | Fondo del palco frontal y su retranqueo hacia el muro lateral. Su suma con `limitesFrontal().xFrente` da x = 9,00, la línea a la que `adelantaPalcosProscenio()` trae el palco 2 del principal. |
| `RETIRO_ESCENARIO_Z` | Retiro de 2,5 m, derivado de `geo.frenteEscenico`: aloja la diagonal sin recortar los palcos. |
| `AVANCE_ALAS_EMBOCADURA` | Avance de las alas diagonales (1,5 m) hasta el comienzo fijo de los palcos frontales en z = −1 m. |
| `Z_CORREDOR_INI`, `Z_CORREDOR_FIN` | Límites del pasillo transversal; marcan también dónde arranca el ala de platea. |
| `ALTO_BRAZO` | Altura del brazo de butaca, algo por encima del cojín. |
| `TELON_ANCHO`, `TELON_ALTO`, `TELON_Z`, `TELON_X_ABIERTO`, `TELON_DURACION` | Dimensiones, posición y tiempo de apertura del telón. |
| `FONDO_MAMPARA` | Espesor de las mamparas. Único mando: lo usan la extrusión, el fondo de las jambas y el retranqueo de media pieza contra la alfombra. |
| `HOLGURA_VALLA_ALFOMBRA` | Separación entre la valla y el borde visible de la alfombra. Único mando para acercarla o separarla; a cero, la curva de la valla cae justo sobre el borde. |
| `CAJA_ESCALERA` | Fuente compartida de geometría y navegación. Define una planta cuadrada mediante `W=3.20`, `HUELLA=0.40` y `PELDANOS=7`. Genera tres vuelos y sus rellanos entre cada pareja de cotas de `niveles`, derivadas de platea y `P.pisos`. Todas las plantas conservan la misma huella; cambia solo la contrahuella. `xMax` prolonga el pasillo EXIT hasta la nueva caja. Las dos alas se reflejan sobre X. |

## Regla para futuras modificaciones

No se deben recalcular localmente los bordes de las alfombras posteriores. Hay que usar `ejeAlfombraPasillo`, `anchoAlfombraPasillo` o `bordeAlfombraPasillo`. Esto mantiene alineados alfombra, rampas, plataforma técnica y terminaciones de los palcos.

La floritura de `geometriaBalaustreOrnamental` combina rombos superiores, volutas, óvalo central y hojas inferiores con filetes en relieve por ambas caras. Los calados no se solapan. La geometría se comparte por altura y se monta mediante instancias.

**Es la pieza que manda sobre el coste del render.** Se repiten unas 440 copias entre los cuatro niveles, así que su recuento domina el de la escena entera: con el teselado original (`curveSegments` 10, `bevelSegments` 2, filetes de 32×4) salía a 7808 triángulos por balaustre, o sea 3,4 de los 3,8 millones que se dibujaban al mirar el patio — el 90 %. Los filetes son tubos de 2,5 mm de radio y por sí solos ponían 5120 de esos triángulos, pese a no llegar a un par de píxeles ni vistos desde el propio palco.

`SEG_CURVA` (6), `SEG_BISEL` (1), `SEG_FILETE` (10) y `LADOS_FILETE` (3) fijan ese teselado. Con ellos el balaustre baja a 2364 triángulos y la escena a 1,41 millones. Medido con el mismo banco —25 frames a 2370×1059, con `readPixels` para esperar a la GPU, y el mínimo de tres tandas— el frame pasa de 12,03 a 6,65 ms en la vista de butaca y de 14,17 a 8,31 ms en la de paraíso. Bajar la resolución a la cuarta parte sólo lo deja en 5,06 ms, así que lo que queda es coste de geometría, no de relleno: si hiciera falta más, el siguiente recorte está otra vez en los filetes.

`geo.frenteEscenario(x)` define el borde de la tarima: extremos en z = −1 m y avance central de 0,65 m. `geo.frenteFoso(x)` sitúa el centro de la valla en z = 1,65 m, a 15 cm del borde de la alfombra transversal. Geometría y modo paseo usan estas mismas funciones; el retiro de la caja escénica y los telones sigue siendo 2,5 m. Estas cotas son aproximaciones visuales a las referencias, no medidas del teatro.

El fondo del foso está a y = −0,90 m. `geo.contornoPatioConFoso()` recorta la cavidad en el parquet; `geo.alturaAccesoFoso()` y `geo.bloqueaBarandillaFoso()` mantienen el paseo alineado con ambos accesos. Los vuelos discurren hacia el centro entre |x| = 7,80 y 6,12 m, con huellas de 28 cm y contrahuellas de 15 cm. Los rellanos laterales enlazan con el paso del patio. El faldón curvo del escenario usa `MaderaPlateaInferior.webp`.
