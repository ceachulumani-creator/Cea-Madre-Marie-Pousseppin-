# Activar la actualización del CEA

## Si el boletín muestra «Dirección ha bloqueado este registro»

La versión actual permite corregir y publicar las notas de la propia área aunque el registro tenga un bloqueo antiguo. Si aparece ese mensaje, la implementación que atiende a la web todavía ejecuta una versión anterior.

Copia el contenido completo de `google-apps-script.gs` en el proyecto de Apps Script vinculado a la web. Guarda y entra en **Implementar > Gestionar implementaciones > Editar > Nueva versión > Implementar**. Guardar el código sin actualizar la implementación no cambia el servidor utilizado por la página. Conserva la URL `/exec` de esa implementación y publica también `calificaciones.js` e `index.html` actualizados. No borres las notas ni los estudiantes para solucionar el bloqueo.

## Actualización completa

El apartado docente **Usuario y contraseña** ahora incluye **Nombre completo del docente**. Para habilitar su guardado también debes actualizar la implementación de Apps Script con el archivo de este proyecto. El docente confirma su contraseña actual y puede dejar vacía la nueva contraseña cuando solo necesita corregir su nombre. Publica `calificaciones.js`, `calificaciones.css`, `cea-persistencia.js` e `index.html` actualizados.

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
