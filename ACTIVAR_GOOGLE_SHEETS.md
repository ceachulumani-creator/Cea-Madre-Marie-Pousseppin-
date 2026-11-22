# Activar la actualización del CEA

## Registro movil en tabla (73.93)

Publica `index.html`, `calificaciones.js`, `criterios-evaluacion.js`, `panel-academico.js` y el nuevo `notas-movil.css`, conservando los otros archivos actuales. Este ajuste visual no requiere modificar ni volver a publicar Apps Script.

En pantallas de hasta 900 px se muestra una tabla de estudiantes con numero y nombre fijos a la izquierda y nota final fija a la derecha. Las dimensiones se desplazan horizontalmente. En modo docente, Completo muestra los criterios y sus promedios; Resumen muestra los promedios por dimension. Sin criterios, Completo permite llenar las dimensiones y Resumen muestra los resultados y observaciones. Cambiar la vista no modifica ni descarta las notas pendientes. El guardado conserva el mismo registro y las mismas reglas de evaluacion. La vista de computadora y la impresion mantienen su formato anterior.

## Paneles y permisos de documentos (73.92)

Actualiza `google-apps-script.gs` y publica una **Nueva version** de la implementacion: Direccion y docentes de comision pueden administrar los documentos institucionales; visitantes y docentes sin comision no pueden modificarlos. Los horarios mantienen sus permisos anteriores.

Publica los archivos actuales `index.html`, `app.js`, `calificaciones.js`, `criterios-evaluacion.js`, `calificaciones.css` y los nuevos `panel-academico.js` y `panel-academico.css`. Conserva los demas archivos del sitio. Cada apertura o recarga solicita nuevamente usuario y contrasena. Minimizar conserva la sesion actual, el registro y los cambios pendientes; Volver al panel retoma esa pantalla. Cerrar sesion elimina los controles de edicion y el acceso al panel. Una recarga requiere ingresar nuevamente.

En el registro con criterios, las flechas mantienen la casilla visible a la derecha de las columnas fijas. Una barra de desplazamiento con botones permite mover la tabla con mouse. Cuando los nombres ocupan casi todo el ancho, las columnas de identidad se desplazan junto con la tabla para dejar acceso a las notas. Los paneles moviles usan el ancho disponible, controles tactiles y desplazamiento de pagina para ambos roles; no dependen de una resolucion fisica especifica del celular. No se requieren hojas nuevas ni importar nuevamente datos.

## Evaluación con criterios y promedios editables

**Actualizacion 73.91:** para quitar definitivamente un criterio y sus calificaciones, actualiza `google-apps-script.gs` y publica una **Nueva version** de la implementacion. Publica tambien `criterios-evaluacion.js`, `calificaciones.js`, `calificaciones.css` e `index.html`; conserva los demas archivos actuales. Quitar muestra una confirmacion centrada y la eliminacion se realiza al pulsar Guardar. Se retiran las notas de ese criterio de las tablas vigentes, del historial y de la papelera. No se requieren hojas nuevas ni volver a importar estudiantes.

La tabla incluye Heteroevaluación (90 puntos), Autoevaluación (10 puntos) con criterios opcionales, y Calificación final con Numeral y Observación automáticos. Para habilitar criterios de autoevaluación debes actualizar tanto Apps Script como los archivos web; las notas anteriores se conservan.

Actualiza el contenido completo de `google-apps-script.gs` y selecciona **Implementar > Gestionar implementaciones > Editar > Nueva versión > Implementar**. Publica también `criterios-evaluacion.js`, `calificaciones.js`, `calificaciones.css`, `calificaciones-impresion.css` e `index.html`. Para esta ampliación no hace falta volver a importar estudiantes ni ejecutar de nuevo la configuración inicial: las tablas de criterios se crean o amplían al guardar.

En modo docente, activa **Evaluar con criterios** en Llenar notas. Todos los promedios empiezan bloqueados, tambien los de dimensiones sin criterios. Utiliza doble clic y **Editar promedio**, o doble toque en celular, para habilitar una dimensión. Se bloquean de nuevo al guardar o reabrir el registro. Los ajustes expresos de promedios y notas del boletín sincronizan los criterios activos y conservan su origen en el historial. Activar la opción no cambia notas anteriores.

Con criterios se imprime en Carta horizontal; sin criterios, Carta vertical. Consulta `CRITERIOS_EVALUACION.md` para las escalas, almacenamiento y funcionamiento detallados.

## Si el boletín muestra «Dirección ha bloqueado este registro»

La versión actual permite corregir y publicar las notas de la propia área aunque el registro tenga un bloqueo antiguo. Si aparece ese mensaje, la implementación que atiende a la web todavía ejecuta una versión anterior.

Copia el contenido completo de `google-apps-script.gs` en el proyecto de Apps Script vinculado a la web. Guarda y entra en **Implementar > Gestionar implementaciones > Editar > Nueva versión > Implementar**. Guardar el código sin actualizar la implementación no cambia el servidor utilizado por la página. Conserva la URL `/exec` de esa implementación y publica también `calificaciones.js` e `index.html` actualizados. No borres las notas ni los estudiantes para solucionar el bloqueo.

## Actualización completa

El perfil de la especialidad se guarda con **guardar-perfil-especialidad**, limitado al área de la sesión docente y con confirmación del servidor. La publicación de notas está disponible para Dirección y Docente. Los controles **SUBIDO**, marcar y desmarcar del centralizador se muestran únicamente en Dirección. Los permisos de horarios se conservan. Para aplicar estos ajustes, actualiza la implementación de Apps Script y publica los archivos web actualizados.

El apartado docente **Usuario y contraseña** tiene dos formularios independientes. **Nombre del docente** se guarda con la sesión iniciada, sin pedir contraseña. **Usuario y contraseña** requiere la contraseña actual; para cambiar la clave hay que escribir la nueva y confirmarla. Actualiza la implementación de Apps Script y publica `app.js`, `calificaciones.js`, `calificaciones.css`, `cea-persistencia.js` e `index.html`. En Dirección, espera el mensaje **Datos guardados y confirmados** antes de cerrar la página. Ese mensaje aparece después de releer los nombres escritos en el servidor.

1. En Google Drive, crea una copia privada de la hoja oficial. Comprueba que la nómina y las notas estén en esa hoja.
2. Abre la hoja oficial y entra en **Extensiones > Apps Script**. Sustituye el código anterior por el contenido completo de `google-apps-script.gs` y guarda.
3. Selecciona la función **configurarSistemaCEA** y pulsa **Ejecutar**. Autoriza la ejecución con la cuenta propietaria. La función vincula el archivo oficial, agrega los identificadores de matrícula y conserva los registros existentes. Si la nómina oficial todavía está en Excel, impórtala desde Dirección después de publicar la nueva versión.
4. Ve a **Implementar > Gestionar implementaciones**. Edita la implementación que usa la web, selecciona **Nueva versión** y pulsa **Implementar**. Usa **Ejecutar como yo** y el acceso **Cualquier persona** para que funcionen los formularios públicos. Mantén el archivo de Google Sheets privado.
5. Publica los archivos actualizados del sitio en GitHub Pages. Incluye `cea-persistencia.js`. Si conservaste la implementación, conserva su URL `/exec`. Si creaste otra, actualiza la URL en `app.js` y en el campo `adm-gsheet-url` de `index.html`.
6. Ingresa con una cuenta de Dirección y una de Docente. Guarda una nota de prueba y comprueba que aparezca en Google Sheets. Da de baja una matrícula de prueba y comprueba que las demás carreras, niveles y paralelos conserven sus datos. Recupera la matrícula desde la papelera.

Los archivos de respaldo, las pruebas y las versiones anteriores de la página deben mantenerse fuera de GitHub Pages. Si la versión anterior estuvo accesible en Internet, renueva las contraseñas de las cuentas que se usaron allí.

## Organizar un respaldo existente

En el editor de Apps Script, guarda el archivo actualizado y ejecuta una vez **organizarRespaldoNominaCEA**. La pestaña **Nomina_Respaldo** mostrará una fila por matrícula, con columnas para estudiante, carrera, nivel, paralelo, gestión y semestre. La columna que usa la recuperación queda oculta. Los semestres antiguos guardados como «Hoja 1», «Hoja 2» u otros nombres similares se muestran como **Por revisar**.

Publica los archivos web actualizados para aplicar los cambios de navegación y de conteo en Dirección y Docente.

Para los ajustes de impresion y edicion de criterios (paginacion por espacio disponible, resumen y sellos al final, doble clic y arrastre, filas resaltadas y ventanas centradas), publica criterios-evaluacion.js, calificaciones.js, calificaciones.css, calificaciones-impresion.css e index.html. Si ya actualizaste Apps Script para los criterios de autoevaluacion, estos ajustes no requieren otra version del servidor.

Para la versión 73.82 (notas sin decimales), actualiza google-apps-script.gs y publica una Nueva versión de la implementación. Publica también calificaciones.js, criterios-evaluacion.js, calificaciones.css e index.html. El servidor redondea cada nota y promedio antes de sumar y guardar, con la misma regla de la web.

Para la versión 73.88 (precarga de criterios), actualiza google-apps-script.gs y publica una Nueva versión de la implementación. Publica cea-persistencia.js, criterios-evaluacion.js, calificaciones.js, calificaciones.css, calificaciones-impresion.css e index.html. La precarga respeta la cuenta y la especialidad; solo contiene los criterios privados de la cuenta docente.
