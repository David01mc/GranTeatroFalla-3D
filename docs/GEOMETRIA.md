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
| `alfombra` | Cinta texturizada que sigue un eje, con anchura fija o calculada por punto. |
| `alfombraVariable` | Alfombra cuyo ancho se proporciona explícitamente en cada vértice. |
| `enlaceAlfombra` | Trapecio que une alfombras con orientaciones o anchuras distintas. |

## Patio de butacas y pasillos

| Función | Objeto o responsabilidad |
| --- | --- |
| `limitesFrontal` | Límites seguros de los dos palcos frontales junto al escenario. |
| `zFila` | Posición longitudinal de una fila del patio. |
| `sitiosCentro` | Coordenadas de las butacas del bloque central. |
| `sitiosLateral` | Coordenadas de las butacas laterales, respetando el pasillo junto al muro. |
| `enBloqueAsientos` | Zona lógica ocupada por las filas; la consulta el modo paseo. |
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
| `embocadura` | Jambas, arco superior, paños decorados y molduras de la boca escénica. |
| `perfilCortina`, `perfilMedioTelon`, `cortina` | Geometría ondulada de cortinas y telón. |
| `juegoTelon` | Bambalinas y patas laterales. |
| `construirTelonFuncional` | Telón principal animado. |
| `suaveT`, `actualizarTelon`, `alternarTelon` | Estado y animación de apertura/cierre del telón. |
| `escenario` | Tarima, telones y elementos interiores del escenario. |
| `sueloFoso` | Suelo del espacio reservado delante del escenario. |

## Accesos laterales

| Función | Objeto o responsabilidad |
| --- | --- |
| `escalerasLaterales` | Escalones alfombrados próximos al escenario. |
| `mamparasEscaleras` | Mamparas mudéjares de tres arcos junto al palco 2. |
| `texturaSalida` | Cartel generado para “SALIDA / EXIT”. |
| `salidasEscalerasPasillo` | Rellanos que comunican las escaleras con el corredor posterior. |

## Palcos de platea

| Función | Objeto o responsabilidad |
| --- | --- |
| `indicesPorLongitud` | Divide un tramo curvo en palcos de longitud semejante. |
| `posteYesoEnIndice` | Separador bajo ondulado entre dos palcos. |
| `separadoresPalco` | Distribuye los separadores de un grupo de palcos. |
| `geometriaBalaustreOrnamental` | Pieza calada individual de la barandilla. |
| `barandillaPalco` | Zócalo, balaustres y pasamanos de una barandilla. |
| `tramosPlateaSinSalidas` | Corta una curva en los accesos 1 y 5. |
| `barandillaPlateaConSalidas` | Barandilla de platea dejando libres ambos accesos. |
| `construirSillaPalco`, `sillasPalco` | Sillas simplificadas y distribución dentro de cada palco. |
| `geometriaCortinaPalco` | Hoja recogida de terciopelo de una portada. |
| `columnaMudejar` | Columna completa compartida entre arcos. |
| `portadasPalcosPlatea` | Arcos, paños superiores, dientes, adornos, columnas y cortinas. |
| `antepalcosPlatea` | Extensión posterior de 2 m, tabiques y puertas de cada palco. |
| `pasilloCurvoPalcos` | Corredor curvo común situado detrás de los antepalcos. |

## Puertas e interacción

| Función | Objeto o responsabilidad |
| --- | --- |
| `puertaCercana` | Busca la puerta interactiva más próxima. |
| `alternarPuertaCercana` | Cambia el objetivo abierto/cerrado de una puerta. |
| `actualizarPuertas` | Interpola la animación de las hojas. |
| `puertaBloquea` | Colisión simplificada de una puerta cerrada. |
| `signoPuerta` | Sentido de apertura según el lado del teatro. |

## Fondo y pisos superiores

| Función | Objeto o responsabilidad |
| --- | --- |
| `palcoAutoridades` | Sala central del piso principal y sus aproximadamente 40 asientos. |
| `fondoTecnicoPlatea` | Rampas posteriores, plataforma de las tres cabinas y fachada curva de cinco arcos. |
| `texturaTecho` | Carga la pintura del techo. |
| `lampara` | Araña central simplificada. |

## Montaje

`construir(escena)` coordina todos los componentes. Dentro de su rama de platea también crea:

- los dos palcos frontales;
- la peana y el muro portante;
- el parquet de las alas laterales;
- las terminaciones curvas junto a las alfombras posteriores;
- los pisos principal, segundo y paraíso;
- las luces generales y las luces auxiliares de los palcos frontales.

La API pública queda expuesta como `FALLA.escena.construir`. Las puertas se publican mediante `FALLA.puertas` y el telón mediante `FALLA.telon`.

## Regla para futuras modificaciones

No se deben recalcular localmente los bordes de las alfombras posteriores. Hay que usar `ejeAlfombraPasillo`, `anchoAlfombraPasillo` o `bordeAlfombraPasillo`. Esto mantiene alineados alfombra, rampas, plataforma técnica y terminaciones de los palcos.
