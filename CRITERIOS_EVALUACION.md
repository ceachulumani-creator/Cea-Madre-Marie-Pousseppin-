# Evaluacion opcional por criterios

Actualizacion 73.91: **Quitar criterio** abre una confirmacion centrada con el nombre del criterio y el aviso de que sus calificaciones se eliminaran para todos los estudiantes de ese modulo. Cancelar conserva los datos. La eliminacion se confirma con **Guardar**: retira la definicion y sus notas, incluidos los valores del historial y de las matriculas en papelera, para que no reaparezcan al recuperar estudiantes. Las notas de los otros criterios se conservan. Si quedan criterios completos, se recalcula el promedio; sin criterios restantes se conserva la ultima nota consolidada. Desactivar la evaluacion con criterios sigue conservando los datos.

Esta actualizacion requiere publicar una **Nueva version de Apps Script** y los archivos web actualizados. La interfaz verifica que el servidor admita la eliminacion definitiva antes de permitirla. El guardado incluye las notas oficiales, los criterios y la papelera en la misma transaccion. Volver a un modulo cuyos criterios ya estan cargados reutiliza su estado en memoria, sin otra consulta ni reconstruccion de sus datos. Los archivos antiguos archivados siguen siendo recuperables; la accion actual Quitar elimina en lugar de archivar.

La opcion aparece exclusivamente en **Llenar notas**, en modo docente. Cada cuenta conserva sus criterios por registro: especialidad o materia, nivel, paralelo, modulo, gestion y semestre. No cambia el esquema ni las ponderaciones de las notas oficiales existentes.

| Dimension | Tecnica | Humanistica |
|---|---:|---:|
| Ser | 10 | 10 |
| Saber | 30 | 40 |
| Decidir | 10 | 10 |
| Hacer | Proceso 20 + Producto 20 | 30 |
| Autoevaluacion | 10 | 10 |

## Uso

1. Activa **Evaluar con criterios**. La planilla conserva sus notas actuales.
2. Elige si cada criterio se evalua sobre 100 o sobre el maximo de su dimension.
3. Usa **+** para añadir criterios. Cada dimension admite una cantidad diferente. Los criterios tienen el mismo peso dentro de su dimension.
4. Escribe las calificaciones. Un espacio vacio significa pendiente; cero es una calificacion expresa. El promedio incompleto se muestra como provisional y no sustituye la nota oficial.
5. Pulsa **Guardar** en la cabecera. Se guardan juntos los criterios y los resultados oficiales. Si se reemplazan notas existentes, revisa la confirmacion antes de aceptar.

Sobre 100: promedio de criterios multiplicado por el maximo de la dimension y dividido entre 100. En escala de dimension: promedio directo. Las notas de criterios y los promedios de dimensión se redondean a enteros (0 decimales) antes de sumarse. El total es la suma de esos enteros; no conserva fracciones ocultas. Proceso y Producto se calculan por separado. La autoevaluacion conserva su campo oficial de 10 puntos y admite criterios opcionales propios, sobre 100 o sobre 10. Sus promedios completos se guardan en ese mismo campo; no se suma dos veces.

Desactivar la opcion conserva definiciones y notas. Quitar un criterio lo archiva; puede recuperarse. **Copiar criterios de otro modulo** copia solo definiciones activas de la propia cuenta, con identificadores nuevos, sin las calificaciones.

Si se edita expresamente una dimension en el registro, sus criterios activos se ajustan automaticamente para reproducir esa nota. Las otras dimensiones y la autoevaluacion se conservan. Si se edita una nota final en el boletin, se utiliza primero la distribucion habitual entre dimensiones y autoevaluacion; el servidor ajusta despues los criterios activos de cada dimension, aunque el docente no tenga abierto el registro. Los valores se mantienen dentro de sus limites y se distribuyen con variacion cuando es posible; en cero y en el maximo pueden coincidir necesariamente.

Los valores asignados desde una nota oficial aparecen marcados **Ajustado automaticamente** y conservan su origen en el historial. Son una distribucion calculada, pendiente de revision pedagogica del docente. La ultima edicion expresa prevalece: editar criterios completos actualiza su promedio; editar el promedio ajusta sus criterios. Activar o abrir criterios no rellena evaluaciones historicas. Desactivar conserva los datos; Quitar elimina el criterio y sus calificaciones al guardar.

**Edicion temporal de promedios:** estan bloqueados por defecto en todas las dimensiones al activar la evaluacion con criterios. Un doble clic sobre cualquier promedio o su encabezado y la opcion **Editar promedio** habilitan la columna de esa dimension para todos los estudiantes del registro abierto. En celular se utiliza doble toque y **Editar promedio**. No hay boton Opciones ni accion de clic derecho para promedios. Todos los promedios, incluso los de dimensiones sin criterios, empiezan bloqueados. El permiso no se guarda: vuelve a bloquearse al guardar correctamente, reabrir el registro, recargar o cambiar de sesion. No exige desbloquear las otras dimensiones.

**Impresion:** con criterios activos, el registro docente imprime en Carta horizontal; sin criterios, utiliza el consolidado habitual en Carta vertical. La cantidad de criterios por bloque se calcula con el ancho imprimible de Carta horizontal, sin un límite por dimensión. Los anchos de criterios y promedios se reparten después de reservar el espacio de nombres, numeral, observación y separaciones. Se mantienen cifras de al menos 7.5 pt y anchos mínimos de 6.4 mm para criterios y 6.6 mm para promedios, con un máximo de veinte criterios por bloque. Si todos caben, se imprimen en una sola tabla; en caso contrario, se crean bloques adicionales que repiten la identidad, todas las dimensiones, autoevaluacion, numeral y observacion. La cantidad de estudiantes por hoja se calcula midiendo el espacio imprimible real, sin un limite fijo de seis; las filas que no caben pasan a la siguiente pagina. Se mantiene el diseno de Valoracion del modulo, con sus bordes. Los encabezados de criterios son grises y los nombres de las filas pares tienen un verde sutil. El resumen estadistico aparece una sola vez al final, seguido de los nombres y cargos de docente y director, alineados y con espacio para sus sellos y firmas. Los nombres de criterios aparecen en sus cabeceras: hasta dos líneas con veinte criterios, y más líneas si hay ancho disponible. Si el nombre no cabe, termina con puntos suspensivos. No se imprimen claves C1/C2 ni leyendas debajo. Las cantidades mayores se reparten en paginas adicionales. Si hay cambios pendientes, se ofrecen **Guardar e imprimir**, **Imprimir ahora** y **Cancelar** antes de imprimir. Estos avisos nunca se incluyen en el documento. La impresion de Direccion y el boletin centralizador conservan su formato consolidado.

En computadora, la tabla conserva las columnas Numero, Apellido paterno, Apellido materno y Nombres. Cada columna se ajusta al texto mas largo de la nomina y permanece fija al desplazar los criterios. Las dimensiones agrupan encabezados verticales para sus criterios y el promedio, con la misma paleta del registro sin criterios. El boton + agrega criterios. Un doble clic o doble toque sobre el nombre abre su edicion; alli, Quitar criterio solicita confirmacion para eliminar el criterio y sus calificaciones al guardar. Mantener pulsado y arrastrar permite cambiar su orden dentro de la misma dimension. Despues de Heteroevaluacion (90 puntos) aparece Autoevaluacion (10 puntos), con sus criterios y promedio. Al final estan Calificacion final, Numeral y Observacion, sincronizados con el registro oficial.

En celular, el editor organiza los criterios por estudiante y dimension. La autoevaluacion aparece tambien entre las dimensiones seleccionables y permite añadir sus propios criterios. El Numeral y la Observacion se muestran en el mismo editor y se actualizan al escribir. En Direccion y en los boletines oficiales solo se muestran los resultados consolidados.

## Almacenamiento

Los criterios se guardan en filas independientes, sin añadir columnas variables a las planillas oficiales:

- **Criterios_Configuracion**: registro, cuenta docente, interruptores, revision y contexto academico.
- **Criterios_Definiciones**: una fila por criterio, con dimension, titulo, orden y estado activo/archivado.
- **Criterios_Notas**: una fila por criterio y detalle oficial de estudiante, conservando tambien la escala y el origen manual o automatico de esa calificacion.
- **Criterios_Resultados**: ultimo resultado aplicado a cada estudiante y dimension.
- **Criterios_Historial**: cambios de configuracion, criterios y calificaciones.

Los identificadores de notas se vinculan al detalle oficial, asociado a la matricula. Los cambios de nombre u orden alfabetico no reasignan criterios a otra persona. La baja de matricula retira sus notas y resultados de criterios; la recuperacion desde papelera los restaura. Un nuevo semestre o gestion empieza con calificaciones independientes.

El servidor verifica la cuenta, la especialidad y el registro existente, valida las escalas y recalcula los promedios. Una revision impide que dos pestañas de la misma cuenta sobrescriban criterios distintos sin advertencia. Las correcciones manuales concurrentes se detectan antes de aplicar el promedio. El guardado de notas oficiales y criterios comparte la misma transaccion con recuperacion ante errores. Los datos privados de criterios no se incluyen en las consultas publicas ni en la carga general de Direccion.

**Recargar criterios guardados** permite consultar la version del servidor cuando otra pestaña haya actualizado el registro. Si hay cambios locales, solicita confirmacion antes de descartarlos. La escala guardada en cada nota permite recuperar una matricula correctamente aunque el curso haya cambiado de evaluacion sobre cien a escala de dimension mientras estaba en papelera.

## Actualizacion

1. Conserva un respaldo privado de los datos oficiales.
2. Actualiza **google-apps-script.gs** y publica una **Nueva version** de la implementacion que utiliza la web. Guardar el codigo sin actualizar la implementacion no cambia el servidor publicado.
3. Publica **criterios-evaluacion.js**, **calificaciones.js**, **calificaciones.css**, **calificaciones-impresion.css** e **index.html** actualizados. Mantiene tambien los demas archivos del proyecto en su version actual.
4. Las cinco pestañas nuevas se crean al primer guardado de criterios. El soporte de criterios de autoevaluacion requiere publicar tambien la nueva version de Apps Script; no requiere pestañas adicionales. No se requiere convertir notas historicas ni volver a importar estudiantes.
5. Comprueba primero un modulo: activar sin escribir notas, añadir criterios, guardar, recargar y comparar las dimensiones con el boletin.

Los horarios y las dimensiones reglamentarias permanecen con su funcionamiento previo. Las notas oficiales se guardan y publican mediante las rutas existentes.

La impresion utiliza un documento separado con calificaciones-impresion.css: conserva la cabecera, los datos institucionales, bordes, estadisticas y firmas de Valoracion del modulo. Con criterios imprime Carta horizontal; sin criterios, Carta vertical. Los controles y dialogos de la pagina no forman parte de ese documento. Para este cambio de edicion e impresion no se requieren cambios adicionales en Apps Script.

La fila completa del estudiante seleccionado se resalta al hacer clic o navegar entre notas; la celda mantiene su foco. Las ventanas de impresion y criterios se centran, usan los colores institucionales y se abren con una animacion breve desde su control de origen, respetando la preferencia de movimiento reducido. Estos ajustes solo requieren publicar los archivos web, incluida calificaciones-impresion.css; no cambian Apps Script ni los datos guardados.

Los espacios de sello y firma miden 20 mm de alto. Debajo aparecen tres filas alineadas: nombre con Lic., cargo (Docente o Director) y especialidad/carrera o nombre del centro tomado de la cabecera de la pagina. El cierre se mide junto a la ultima tabla y solo pasa a otra hoja si no cabe. Los avisos de cambios sin guardar y los dialogos nativos revisados comparten centrado, estilo institucional y apertura breve.

La actualización de notas enteras requiere publicar una nueva versión de Apps Script y los archivos web calificaciones.js, criterios-evaluacion.js, calificaciones.css e index.html (73.82). Las lecturas normalizan los decimales previos; al guardar se persisten enteros. El redondeo puede corregir un total antiguo que se calculó con fracciones. No se eliminan registros ni criterios. Con criterios activo se muestra únicamente ese registro, sin marco ni altura interna recortada.

En el ajuste visual 73.83, el cuerpo completo del registro con criterios no tiene líneas divisorias, incluidas las notas y los promedios. Las cabeceras conservan sus divisiones y la fila seleccionada muestra el mismo borde azul del registro sin criterios. Este ajuste solo requiere publicar calificaciones.css e index.html; no añade cambios a Apps Script.

El ajuste 73.84 dibuja el contorno azul también en las columnas fijas de número, apellidos y nombres. Al seleccionar una calificación, toda la fila conserva el resaltado incluso al desplazar horizontalmente la tabla. Solo cambia calificaciones.css e index.html.

La impresión adaptable 73.85 requiere publicar criterios-evaluacion.js, calificaciones.js, calificaciones-impresion.css e index.html. No requiere actualizar Apps Script ni modificar las notas guardadas.

La versión 73.86 conserva la dimensión, el estudiante seleccionado y el desplazamiento al editar, añadir o reorganizar criterios. En Carta horizontal caben juntos veinte criterios con distribución Ser 4, Saber 4, Decidir 2, Proceso 4, Producto 4 y Autoevaluación 2, con sus seis promedios, numeral y observación. Se ajustan el espacio entre celdas y los anchos, sin reducir las cifras de 7.5 pt. Las cantidades mayores se siguen imprimiendo en bloques adicionales; no se borran ni se limitan los criterios guardados. Publicar criterios-evaluacion.js, calificaciones.js, calificaciones-impresion.css e index.html; no requiere cambios de Apps Script.

La versión 73.87 ajusta las columnas web al texto de cada criterio, desde 48 px y con hasta cuatro líneas giradas. El texto completo se conserva en el criterio y su editor; los recortes visuales se indican con puntos suspensivos. Los promedios web se muestran en negrita y sus casillas impresas conservan el borde verde, con negrita según la paridad de la fila. Publicar criterios-evaluacion.js, calificaciones.js, calificaciones.css, calificaciones-impresion.css e index.html. No requiere cambios en Apps Script ni en notas guardadas.

La versión 73.88 precarga los criterios privados de la cuenta docente junto con los datos iniciales. El servidor lee cada una de las cuatro tablas de criterios una sola vez para todos los registros permitidos. La web conserva copias en memoria por sesión, comparte consultas simultáneas e invalida los datos tras guardar; salir borra la memoria privada. Las lecturas no bloquean la cola de guardados. Las columnas de notas y promedios se ajustan a los valores visibles y al texto; pasar de 99 a 100 amplía la columna sin reconstruir la tabla ni perder el foco.

En impresión, los nombres de criterios usan texto normal. Toda fila de estudiante par usa negrita, y toda fila impar texto normal, incluidos nombres, criterios, dimensiones, promedios y observación. La paridad se mantiene al continuar en otra hoja. El pie queda en la esquina inferior derecha, en gris claro: Página en texto normal y los números de página y total en negrita. El espacio del pie se reserva al paginar.

Esta versión requiere actualizar google-apps-script.gs y publicar una Nueva versión de la implementación, además de cea-persistencia.js, criterios-evaluacion.js, calificaciones.js, calificaciones.css, calificaciones-impresion.css e index.html. No requiere nuevas hojas ni modifica las calificaciones guardadas.

La versión 73.89 mantiene el interruptor Evaluar con criterios visible y disponible desde que abre el registro, incluso durante la consulta. Una elección hecha mientras se recuperan los datos se aplica al finalizar y Guardar espera su configuración para no confirmar cambios que aún no se han persistido. Las dimensiones sin criterios reservan 112 px para su promedio; con uno, dos o más criterios se compactan progresivamente a mínimos de 76, 48 y 28 px, respetando las cifras visibles. Los títulos impresos utilizan Arial Narrow u otra fuente condensada disponible, con una compresión horizontal de respaldo del 10 % que conserva la altura de las letras. La medición y el ajuste de líneas utilizan la misma fuente. Publicar criterios-evaluacion.js, calificaciones.js, calificaciones.css, calificaciones-impresion.css e index.html. Este ajuste no requiere cambios adicionales en Apps Script; se conserva el servidor 73.88 para la precarga privada.

La versión 73.90 incluye el interruptor de criterios directamente en el HTML inicial de la planilla: la nómina, las notas y la opción se insertan juntas. El componente adopta esos controles y se inicia antes de la navegación de teclado, conservando la elección hecha durante consultas pendientes. La impresión evalúa cada bloque con letra Arial normal: si todos los títulos caben en sus líneas disponibles, mantiene letra normal y sin compresión. Si algún título no cabe, cambia ese bloque a letra condensada y después aplica puntos suspensivos únicamente si siguen siendo necesarios. La elección depende del texto real y el espacio, incluso con veinte criterios. Publicar criterios-evaluacion.js, calificaciones.js, calificaciones-impresion.css e index.html. No requiere actualizar Apps Script.
