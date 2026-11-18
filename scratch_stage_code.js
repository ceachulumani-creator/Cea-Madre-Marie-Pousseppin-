function renderContenidoDocenteStage(tabName) {
    const stage = document.getElementById('docente-stage-content');
    if (!stage) return;
    stage.style.display = 'block';

    // Asegurar que la barra flotante del director jamás aparezca en el entorno docente ni tape la pantalla
    const liveBar = document.getElementById('directorLiveBar');
    if (liveBar) {
      liveBar.style.display = 'none';
      liveBar.classList.add('minimizada');
    }

    // ── REGLA FUNDAMENTAL: AISLAMIENTO ESTRICTO DEL REGISTRO DE EVALUACIÓN ──
    // El "Registro de Evaluación" y su contenedor sólo existen en 'subir_notas' (Llenar Notas / Registro).
    if (tabName !== 'subir_notas') {
      const planillas = document.querySelectorAll('#docente-planilla-container, .calif-planilla-wrapper');
      planillas.forEach(p => {
        p.style.display = 'none';
        p.innerHTML = '';
      });
    }

    // ── PROTECCIÓN KÁRDEX: Si el formulario está montado en stage, parquearlo para no destruirlo ──
    const kForm = document.getElementById('form-kardex-docente');
    if (kForm && stage.contains(kForm)) {
      let parking = document.getElementById('kardex-form-parking');
      if (!parking) {
        parking = document.createElement('div');
        parking.id = 'kardex-form-parking';
        parking.style.display = 'none';
        document.body.appendChild(parking);
      }
      parking.appendChild(kForm);
    }

    const docInfo = obtenerDocenteLogueado() || { areaKey: 'sistemas', name: 'Docente' };
    const tabActiva = window._docTabActiva || (docInfo.areaKey.startsWith('hum') ? 'humanistica' : 'tecnica');
    const asignaciones = window._docAsignaciones || obtenerAsignacionesDocente(docInfo);
    const nombreEspecialidad = tabActiva === 'humanistica'
      ? (asignaciones.humanistica[0]?.carrera || 'Educación Humanística')
      : (asignaciones.tecnica[0]?.carrera || 'Carrera Técnica');

    if (tabName === 'centralizador' || tabName === 'centralizador_digital') {
      stage.innerHTML = `<div id="docente-stage-centralizador"></div>`;
      const nivelDef = tabActiva === 'humanistica' ? 'Aprendizajes Elementales' : 'Técnico Básico';
      mostrarVisorDigitalCentralizador(docInfo.areaKey, _nivelActivoDocente || nivelDef, _gestionActiva, _semestreActivo, _paraleloActivo || 'A', 'docente-stage-centralizador');
      return;
    }

    if (tabName === 'crear_paralelo') {
      renderVistaGestionParalelosDocente(stage, docInfo);
      return;
    }

    if (tabName === 'afiliacion') {
      window._docenteSidebarTab = 'afiliacion';
      const stageAfi = document.getElementById('docente-stage-content') || document.getElementById('docente-calificaciones-slot');
      if (stageAfi) {
        stageAfi.innerHTML = '';
        renderVistaAfiliacionEstudiantes(stageAfi, 'docente', docInfo ? docInfo.areaKey : 'todos');
      }
      return;
    }

    if (tabName === 'impresion_masiva') {
      const ambito = tabActiva === 'humanistica' ? 'area_humanistica' : 'especialidad';
      stage.innerHTML = `
        <div class="calif-card" style="border-top:3.5px solid var(--verde);padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.06);margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:2px solid #e2e8f0;padding-bottom:14px;margin-bottom:20px">
            <div>
              <h3 style="margin:0;color:var(--verde-dark);font-size:1.25rem;font-weight:900;display:flex;align-items:center;gap:8px">
                ${getSvgIcon('PRINT')} Emisión e Impresión Masiva de Boletines — ${escapeHTML(nombreEspecialidad)}
              </h3>
              <p style="margin:4px 0 0 0;font-size:0.83rem;color:var(--text-sec)">
                Generación y emisión centralizada de boletines oficiales de calificaciones de todos los niveles en formato vertical (Carta).
              </p>
            </div>
            <button type="button" class="btn-calif btn-calif-publish" onclick="window.abrirModalImpresionMasiva('${ambito}', '${escapeHTML(docInfo.areaKey)}')" style="padding:9px 18px;font-weight:800;font-size:0.85rem">
              ${getSvgIcon('PRINT')} Abrir Asistente de Impresión Masiva
            </button>
          </div>
          <div style="padding:40px 20px;text-align:center;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#063b17" stroke-width="2" style="margin-bottom:12px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <h4 style="margin:0 0 6px 0;color:#0f172a;font-size:1.15rem;font-weight:900">Módulo de Impresión Masiva Listo</h4>
            <p style="margin:0 0 16px 0;font-size:0.85rem;color:#64748b">Haga clic en el botón superior o inferior para abrir la vista previa e imprimir todos los boletines oficiales.</p>
            <button type="button" class="btn-calif btn-calif-primary" onclick="window.abrirModalImpresionMasiva('${ambito}', '${escapeHTML(docInfo.areaKey)}')" style="padding:10px 22px;font-weight:800;background:#063b17;color:#ffffff;border:none">
              Imprimir Todos los Boletines del Área
            </button>
          </div>
        </div>
      `;
      abrirModalImpresionMasiva(ambito, docInfo.areaKey);
      return;
    }

    // ── KÁRDEX INSTITUCIONAL 2026: VISTA OFICIAL INLINE CON MODO LECTURA Y EDICIÓN INMEDIATA ──
    if (tabName === 'kardex') {
      const docId = docInfo.areaKey || 'hum-mat';
      const targetId = docId;
      const anioActualSistema = new Date().getFullYear();

      stage.style.paddingBottom = '16px';

      const form = document.getElementById('form-kardex-docente');
      const modal = document.getElementById('modal-kardex-editor');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('activo', 'active');
      }

      const liveBar = document.getElementById('directorLiveBar');
      if (liveBar) {
        liveBar.style.display = 'none';
        liveBar.classList.add('minimizada');
      }

      stage.innerHTML = `
        <div class="kardex-inline-fullstage" style="width:100% !important;max-width:100% !important;margin:0 !important;padding:0 8px 16px 8px !important;box-sizing:border-box !important">
          <!-- BARRA SUPERIOR DE ACCIONES INSTITUCIONALES -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;background:#ffffff;padding:14px 20px;border-radius:12px;border:1.5px solid #cbd5e1;box-shadow:0 3px 12px rgba(0,0,0,0.06);width:100% !important;box-sizing:border-box !important">
            <div style="display:flex;align-items:center;gap:12px">
              <div>
                <h3 style="margin:0;color:var(--verde-dark);font-size:1.24rem;font-weight:900;display:flex;align-items:center;gap:8px">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 12h6M9 16h6"/></svg>
                  Mi Kárdex Administrativo ${anioActualSistema}
                </h3>
                <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">
                  <span id="badge-modo-kardex-inline" style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:800;background:#dcfce7;color:#15803d;border:1px solid #86efac">
                    MODO LECTURA OFICIAL
                  </span>
                  <span style="font-size:0.75rem;color:#64748b;font-weight:700">
                    Año del Sistema: ${anioActualSistema}
                  </span>
                </div>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <button type="button" id="btn-toggle-edicion-kardex" class="btn-calif btn-calif-primary" onclick="window.alternarModoEdicionKardexInline(true)" style="background:#063b17;padding:9px 18px;display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:0.86rem;border:none">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span>Editar Mi Kárdex</span>
              </button>
              <button type="button" class="btn-calif btn-calif-secondary" onclick="window.actualizarAnioKardexSistema()" style="font-weight:800;padding:9px 14px;background:#f8fafc;color:#063b17;border:1.5px solid #cbd5e1;display:inline-flex;align-items:center;gap:6px" title="Actualizar gestión y año al año actual del sistema (${anioActualSistema})">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                <span>Actualizar a Gestión ${anioActualSistema}</span>
              </button>
              <button type="button" class="btn-submit" onclick="if(typeof abrirModalElegirDisenoImpresionDocente==='function'){ abrirModalElegirDisenoImpresionDocente('${escapeHTML(targetId)}'); } else if(typeof abrirModalElegirDisenoImpresionKardex==='function'){ abrirModalElegirDisenoImpresionKardex(); }" style="background:#b45309;padding:9px 14px;display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:0.84rem;border:none">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span>Imprimir Kárdex</span>
              </button>
              <button type="button" class="btn-submit" onclick="if(typeof abrirModalElegirDisenoPDFDocente==='function'){ abrirModalElegirDisenoPDFDocente('${escapeHTML(targetId)}'); } else if(typeof abrirModalElegirDisenoPDFKardex==='function'){ abrirModalElegirDisenoPDFKardex(); }" style="background:#0284c7;padding:9px 14px;display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:0.84rem;border:none">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                <span>Guardar PDF</span>
              </button>
            </div>
          </div>

          <div id="kardex-stage-form-mount" style="background:#ffffff;border-radius:12px;border:1.5px solid #cbd5e1;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,0.05);width:100% !important;max-width:100% !important;box-sizing:border-box !important"></div>
        </div>
      `;

      const mount = document.getElementById('kardex-stage-form-mount');
      if (mount && form) {
        form.querySelectorAll('.kardex-modal-footer, .kardex-modal-footer-btns').forEach(el => el.remove());
        document.querySelectorAll('.kardex-modal-footer').forEach(el => el.remove());

        mount.appendChild(form);
        form.style.display = 'block';
        form.style.width = '100%';
        form.style.maxWidth = '100%';
        form.style.boxSizing = 'border-box';

        const btnGuardarOriginal = document.getElementById('btn-guardar-kardex');
        if (btnGuardarOriginal) btnGuardarOriginal.style.display = 'none';

        if (typeof cargarDatosKardexDocenteEnFormulario === 'function') {
          cargarDatosKardexDocenteEnFormulario(targetId);
        } else if (typeof abrirEditorKardex === 'function') {
          abrirEditorKardex(targetId, 'inline');
        }

        if (typeof window.alternarModoEdicionKardexInline === 'function') {
          window.alternarModoEdicionKardexInline(false);
        }
      }
      return;
    }

    if (tabName === 'perfil') {
      const areasTec = (typeof lsGet === 'function') ? lsGet('cea_areas_tec', (typeof AREAS_TEC_DEFAULT !== 'undefined' ? AREAS_TEC_DEFAULT : [])) : [];
      const currentArea = areasTec.find(a => a.key === docInfo.areaKey) || { key: docInfo.areaKey, nombre: nombreEspecialidad, resumen: '' };
      const fotoActual = (typeof obtenerFotoCarreraTec === 'function') ? obtenerFotoCarreraTec(docInfo.areaKey, currentArea) : (currentArea.foto || '');
      const usuariosDoc = (typeof lsGet === 'function') ? lsGet('cea_usuarios_docentes', (typeof USUARIOS_DOCENTES_DEFAULT !== 'undefined' ? USUARIOS_DOCENTES_DEFAULT : {})) : {};
      const uDoc = usuariosDoc[docInfo.areaKey] || {};
      const usuarioActual = uDoc.user || 'profe.' + (docInfo.areaKey || 'docente').replace(/[^a-zA-Z0-9]/g, '');

      stage.innerHTML = `
        <div class="calif-card" style="border-top:3.5px solid var(--verde);padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.06);margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:20px">
            <div style="display:flex;gap:14px;align-items:center">
              <div style="width:52px;height:52px;border-radius:10px;background:var(--verde);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(6,59,23,0.25)">
                ${getSvgIcon('USER')}
              </div>
              <div>
                <h3 style="margin:0;color:var(--verde-dark);font-size:1.25rem;font-weight:900">
                  Perfil de la Especialidad — ${escapeHTML(currentArea.nombre || nombreEspecialidad)}
                </h3>
                <p style="margin:4px 0 0 0;font-size:0.83rem;color:var(--text-sec)">
                  Gestión integral del perfil público, competencias formativas, fotografía y credenciales de acceso.
                </p>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px">
            <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:18px">
              <h4 style="margin:0 0 14px 0;font-size:0.92rem;color:var(--verde-dark);font-weight:900;display:flex;align-items:center;gap:6px">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Información Oficial de la Especialidad
              </h4>
              <form id="form-perfil-especialidad" onsubmit="window.guardarPerfilEspecialidadDocente(event, '${escapeHTML(docInfo.areaKey)}')">
                <div style="margin-bottom:12px">
                  <label style="display:block;font-size:0.80rem;font-weight:700;color:#334155;margin-bottom:4px">Nombre de la Especialidad / Carrera *</label>
                  <input type="text" id="perfil-carrera-nombre" class="calif-filter-input" value="${escapeHTML(currentArea.nombre || nombreEspecialidad)}" required style="width:100%" />
                </div>
                <div style="margin-bottom:12px">
                  <label style="display:block;font-size:0.80rem;font-weight:700;color:#334155;margin-bottom:4px">Descripción / Perfil Formativo *</label>
                  <textarea id="perfil-carrera-resumen" class="calif-filter-input" rows="4" style="width:100%;resize:vertical;font-family:inherit;font-size:0.85rem">${escapeHTML(currentArea.resumen || '')}</textarea>
                  <small style="color:var(--text-sec);font-size:0.75rem;display:block;margin-top:2px">Este texto se muestra en la tarjeta pública de la Oferta Académica.</small>
                </div>
                <button type="submit" class="btn-calif btn-calif-publish" style="font-weight:800;padding:8px 18px;font-size:0.82rem;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px">
                  ${getSvgIcon('CHECK')} Guardar Datos de la Especialidad
                </button>
              </form>
            </div>

            <div style="display:flex;flex-direction:column;gap:16px">
              <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:18px">
                <h4 style="margin:0 0 12px 0;font-size:0.92rem;color:var(--verde-dark);font-weight:900;display:flex;align-items:center;gap:6px">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Fotografía de la Especialidad
                </h4>
                <div style="width:100%;height:130px;border-radius:8px;border:1.5px dashed var(--verde);background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:10px">
                  ${fotoActual ? `
                    <img id="img-preview-perfil-esp" src="${escapeHTML(fotoActual)}" alt="Foto Especialidad" style="width:100%;height:100%;object-fit:cover" />
                  ` : `
                    <div id="ph-preview-perfil-esp" style="color:#94a3b8;font-size:0.80rem;font-weight:700;display:flex;flex-direction:column;align-items:center;gap:4px">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      Sin fotografía asignada
                    </div>
                  `}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <label class="btn-calif btn-calif-primary" style="font-size:0.78rem;padding:6px 12px;font-weight:800;cursor:pointer;flex:1;text-align:center;display:inline-flex;align-items:center;justify-content:center;gap:5px">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span>Subir Foto</span>
                    <input type="file" accept="image/*" style="display:none" onchange="window.procesarFotoEspecialidadDocente(event, '${escapeHTML(docInfo.areaKey)}')" />
                  </label>
                  ${fotoActual ? `
                    <button type="button" class="btn-calif btn-calif-danger" onclick="window.eliminarFotoEspecialidadDocente('${escapeHTML(docInfo.areaKey)}')" style="font-size:0.78rem;padding:6px 12px;font-weight:800;display:inline-flex;align-items:center;gap:5px">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      <span>Quitar</span>
                    </button>
                  ` : ''}
                </div>
              </div>

              <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:18px">
                <h4 style="margin:0 0 12px 0;font-size:0.92rem;color:var(--verde-dark);font-weight:900;display:flex;align-items:center;gap:6px">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Usuario y Contraseña
                </h4>
                <div style="font-size:0.80rem;margin-bottom:8px">
                  <span style="color:#64748b;font-weight:700">Usuario actual:</span> <strong>${escapeHTML(usuarioActual)}</strong>
                </div>
                <button type="button" class="btn-calif btn-calif-secondary" onclick="conmutarVistaDocenteSidebar('seguridad')" style="width:100%;font-size:0.80rem;padding:7px 14px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:6px">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Cambiar Usuario / Contraseña</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (tabName === 'fotografia') {
      const areasTec = (typeof lsGet === 'function') ? lsGet('cea_areas_tec', (typeof AREAS_TEC_DEFAULT !== 'undefined' ? AREAS_TEC_DEFAULT : [])) : [];
      const currentArea = areasTec.find(a => a.key === docInfo.areaKey) || { key: docInfo.areaKey, nombre: nombreEspecialidad };
      const fotoActual = (typeof obtenerFotoCarreraTec === 'function') ? obtenerFotoCarreraTec(docInfo.areaKey, currentArea) : (currentArea.foto || '');

      stage.innerHTML = `
        <div class="calif-card" style="border-top:3.5px solid var(--verde);padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.06);margin-bottom:24px">
          <div style="border-bottom:2px solid #e2e8f0;padding-bottom:14px;margin-bottom:20px">
            <h3 style="margin:0;color:var(--verde-dark);font-size:1.25rem;font-weight:900;display:flex;align-items:center;gap:8px">
              ${getSvgIcon('CAMERA')} Fotografía de la Especialidad — ${escapeHTML(nombreEspecialidad)}
            </h3>
            <p style="margin:4px 0 0 0;font-size:0.83rem;color:var(--text-sec)">
              Esta imagen es la fotografía oficial visible en la página web pública institucional para postulantes e inscripciones.
            </p>
          </div>

          <div style="max-width:540px;margin:0 auto;text-align:center">
            <div style="width:100%;height:260px;border-radius:12px;border:2px dashed var(--verde);background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:16px;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
              ${fotoActual ? `
                <img src="${escapeHTML(fotoActual)}" alt="Fotografía" style="width:100%;height:100%;object-fit:cover" />
              ` : `
                <div style="color:var(--text-sec);display:flex;flex-direction:column;align-items:center;gap:8px">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span style="font-weight:700;font-size:0.88rem">Sin fotografía oficial asignada</span>
                </div>
              `}
            </div>

            <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap">
              <label class="btn-calif btn-calif-publish" style="font-size:0.85rem;padding:9px 20px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Subir Nueva Fotografía</span>
                <input type="file" accept="image/*" style="display:none" onchange="window.procesarFotoEspecialidadDocente(event, '${escapeHTML(docInfo.areaKey)}')" />
              </label>
              ${fotoActual ? `
                <button type="button" class="btn-calif btn-calif-danger" onclick="window.eliminarFotoEspecialidadDocente('${escapeHTML(docInfo.areaKey)}')" style="font-size:0.85rem;padding:9px 16px;font-weight:800;display:inline-flex;align-items:center;gap:6px">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  <span>Quitar Fotografía</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // ── GESTIÓN DE USUARIO Y CONTRASEÑA / SEGURIDAD INSTITUCIONAL ──
    if (tabName === 'seguridad') {
      const usuariosDoc = (typeof lsGet === 'function')
        ? lsGet('cea_usuarios_docentes', (typeof USUARIOS_DOCENTES_DEFAULT !== 'undefined' ? USUARIOS_DOCENTES_DEFAULT : {}))
        : {};
      const uDoc = usuariosDoc[docInfo.areaKey] || {};
      const usuarioActual = uDoc.user || 'profe.' + (docInfo.areaKey || 'docente').replace(/[^a-zA-Z0-9]/g, '');

      stage.innerHTML = `
        <div class="calif-card" style="border-top:3.5px solid var(--verde);padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.06);margin-bottom:24px;max-width:680px;margin-left:auto;margin-right:auto">
          <div style="display:flex;gap:14px;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:20px">
            <div style="width:52px;height:52px;border-radius:10px;background:var(--verde);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(6,59,23,0.25)">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <h3 style="margin:0;color:var(--verde-dark);font-size:1.25rem;font-weight:900">
                Usuario y Contraseña / Seguridad Institucional
              </h3>
              <p style="margin:4px 0 0 0;font-size:0.83rem;color:var(--text-sec)">
                Gestione sus credenciales oficiales de acceso docente al sistema del CEA Madre Marie Poussepin.
              </p>
            </div>
          </div>

          <form onsubmit="window.ejecutarCambioCredencialesDocente(event, '${escapeHTML(docInfo.areaKey)}')">
            <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:18px">
              <div style="margin-bottom:14px">
                <label style="display:block;font-size:0.82rem;font-weight:800;color:#334155;margin-bottom:4px">Usuario de Acceso Actual</label>
                <input type="text" id="sec-nuevo-user" class="calif-filter-input" value="${escapeHTML(usuarioActual)}" required style="width:100%;font-weight:700" />
                <small style="color:#64748b;font-size:0.75rem">Nombre de usuario con el que inicia sesión en la plataforma.</small>
              </div>

              <div style="margin-bottom:14px">
                <label style="display:block;font-size:0.82rem;font-weight:800;color:#334155;margin-bottom:4px">Contraseña Actual *</label>
                <input type="password" id="sec-pass-actual" class="calif-filter-input" placeholder="Ingrese su contraseña actual..." required style="width:100%" />
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
                <div>
                  <label style="display:block;font-size:0.82rem;font-weight:800;color:#334155;margin-bottom:4px">Nueva Contraseña *</label>
                  <input type="password" id="sec-nueva-pass" class="calif-filter-input" placeholder="Mínimo 5 caracteres" required style="width:100%" />
                </div>
                <div>
                  <label style="display:block;font-size:0.82rem;font-weight:800;color:#334155;margin-bottom:4px">Confirmar Nueva Contraseña *</label>
                  <input type="password" id="sec-nueva-pass-conf" class="calif-filter-input" placeholder="Repita la nueva contraseña" required style="width:100%" />
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <input type="checkbox" id="sec-toggle-ver-pass" onchange="const t=this.checked?'text':'password'; ['sec-pass-actual','sec-nueva-pass','sec-nueva-pass-conf'].forEach(id=>{ const el=document.getElementById(id); if(el) el.type=t; });" style="cursor:pointer" />
                <label for="sec-toggle-ver-pass" style="font-size:0.80rem;color:#475569;cursor:pointer;font-weight:600">Mostrar contraseñas en texto claro</label>
              </div>

              <div id="sec-msg-error" style="display:none;background:#fee2e2;color:#b91c1c;padding:10px 14px;border-radius:8px;font-size:0.82rem;font-weight:700;margin-top:10px;border:1px solid #fca5a5"></div>
            </div>

            <button type="submit" class="btn-calif btn-calif-publish" style="width:100%;padding:12px;font-weight:800;font-size:0.90rem;display:flex;align-items:center;justify-content:center;gap:8px">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span>Guardar Cambios de Seguridad</span>
            </button>
          </form>
        </div>
      `;
      return;
    }

    // ── DOCUMENTOS OFICIALES POR NIVELES (CON BOTÓN DE EDITAR Y ELIMINAR) ──
    if (tabName === 'documentos') {
      const keyStorage = 'cea_doc_niveles_' + docInfo.areaKey;
      const docsEspecialidad = (typeof lsGet === 'function') ? lsGet(keyStorage, []) : JSON.parse(localStorage.getItem(keyStorage) || '[]');
      const nivelesCategorias = tabActiva === 'humanistica'
        ? ['Aprendizajes Elementales', 'Aprendizajes Avanzados', 'Aprendizajes Aplicados', 'Aprendizajes Especializados']
        : ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio I', 'Técnico Medio II'];

      stage.innerHTML = `
        <div class="calif-card" style="border-top:3.5px solid var(--verde);padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.06);margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:2px solid #e2e8f0;padding-bottom:14px;margin-bottom:20px">
            <div>
              <h3 style="margin:0;color:var(--verde-dark);font-size:1.25rem;font-weight:900;display:flex;align-items:center;gap:8px">
                ${getSvgIcon('FOLDER')} Documentos Oficiales por Niveles — ${escapeHTML(nombreEspecialidad)}
              </h3>
              <p style="margin:4px 0 0 0;font-size:0.83rem;color:var(--text-sec)">
                Planes curriculares, itinerarios formativos y reglamentos organizados por nivel con edición directa en fila.
              </p>
            </div>
            <span style="background:var(--verde-light);color:var(--verde-dark);font-size:0.80rem;font-weight:800;padding:4px 12px;border-radius:6px">
              Gestión ${escapeHTML(_gestionActiva)}
            </span>
          </div>

          <!-- BOTÓN SUPERIOR PARA NUEVO DOCUMENTO (SIN INTERFERIR CON LA EDICIÓN EN FILA) -->
          <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
            <button type="button" class="btn-calif btn-calif-primary" onclick="window.abrirFormularioNuevoDocumento()" style="padding:8px 16px;font-size:0.84rem;font-weight:800;background:#063b17;color:#ffffff;border:none">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <span>+ Registrar Nuevo Documento</span>
            </button>
          </div>

          <!-- FORMULARIO DESPLEGABLE (OCULTO POR DEFECTO PARA NO DISTRAER DE LA EDICIÓN DIRECTA EN FILA) -->
          <div id="form-doc-nivel" style="display:none;background:#f8fafc;border:2px solid #063b17;border-radius:10px;padding:18px;margin-bottom:22px;box-shadow:0 3px 12px rgba(6,59,23,0.1)">
            <h4 style="margin:0 0 12px 0;font-size:0.88rem;color:var(--verde-dark);font-weight:800">+ Registrar Nuevo Documento a un Nivel Formativo</h4>
            <form onsubmit="window.guardarDocumentoNivelDocente(event, '${escapeHTML(docInfo.areaKey)}')" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:end">
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:700;color:#475569;margin-bottom:3px">Nivel de Destino *</label>
                <select id="doc-nivel-select" class="calif-filter-select" style="width:100%" required>
                  ${nivelesCategorias.map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:700;color:#475569;margin-bottom:3px">Tipo / Título del Documento *</label>
                <input type="text" id="doc-nivel-titulo" class="calif-filter-input" placeholder="Ej: Plan de Módulo I / Guía Técnica" required style="width:100%" />
              </div>
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:700;color:#475569;margin-bottom:3px">Enlace Web / Google Drive o PDF</label>
                <input type="url" id="doc-nivel-enlace" class="calif-filter-input" placeholder="https://drive.google.com/..." style="width:100%" />
              </div>
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:700;color:#475569;margin-bottom:3px">Descripción Breve</label>
                <input type="text" id="doc-nivel-desc" class="calif-filter-input" placeholder="Opcional..." style="width:100%" />
              </div>
              <div>
                <button type="submit" id="btn-submit-doc-nivel" class="btn-calif btn-calif-publish" style="width:100%;font-weight:800;padding:8px 14px;font-size:0.82rem">
                  + Guardar Nuevo Documento
                </button>
              </div>
            </form>
          </div>

          <!-- DOCUMENTOS AGRUPADOS POR NIVELES CON EDICIÓN DIRECTA EN FILA -->
          <div style="display:flex;flex-direction:column;gap:18px">
            ${nivelesCategorias.map(nivCat => {
              const docsNivel = docsEspecialidad.filter(d => (d.nivel || '').toLowerCase() === nivCat.toLowerCase() || (!d.nivel && nivCat === 'Técnico Básico'));
              return `
                <div style="background:#ffffff;border:1.5px solid #063b17;border-radius:10px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,0.05)">
                  <div style="background:#063b17;color:#ffffff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
                    <h4 style="margin:0;color:#ffffff;font-size:1.0rem;font-weight:900;display:flex;align-items:center;gap:8px">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                      ${escapeHTML(nivCat)}
                    </h4>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-size:0.76rem;font-weight:900;background:rgba(255,255,255,0.22);color:#ffffff;padding:2px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.3)">${docsNivel.length} documento(s)</span>
                      <button type="button" class="btn-calif btn-calif-secondary" style="padding:3px 8px;font-size:0.75rem;background:#ffffff;color:#063b17;font-weight:800;border:none" onclick="window.abrirFormularioNuevoDocumento('${escapeHTML(nivCat)}')" title="Añadir documento a ${escapeHTML(nivCat)}">
                        + Añadir
                      </button>
                    </div>
                  </div>
                  <div style="padding:14px">

                  ${docsNivel.length === 0 ? `
                    <p style="margin:0;color:#94a3b8;font-size:0.82rem;font-style:italic">No hay documentos registrados para ${escapeHTML(nivCat)}.</p>
                  ` : `
                    <div class="calif-afiliacion-table-wrap" style="overflow-x:auto;margin-top:0">
                      <table class="calif-afiliacion-table calif-docs-nivel-table" style="width:100%;border-collapse:collapse">
                        <thead>
                          <tr style="background:#e2e8f0;border-bottom:2px solid #94a3b8">
                            <th style="width:150px;text-align:left;padding:9px 10px;background:#e2e8f0;color:#0f172a;font-weight:900">DESTINO / NIVEL</th>
                            <th style="text-align:left;padding:9px 10px;background:#e2e8f0;color:#0f172a;font-weight:900">TIPO DE DOCUMENTO / TÍTULO</th>
                            <th style="width:200px;text-align:left;padding:9px 10px;background:#e2e8f0;color:#0f172a;font-weight:900">ENLACE / ARCHIVO</th>
                            <th style="text-align:left;padding:9px 10px;background:#e2e8f0;color:#0f172a;font-weight:900">DESCRIPCIÓN BREVE</th>
                            <th style="width:110px;text-align:center;padding:9px 10px;background:#e2e8f0;color:#0f172a;font-weight:900">ACCIONES</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${docsNivel.map(doc => {
                            const esEditando = (window._docEditandoId === String(doc.id));
                            if (esEditando) {
                              return `
                                <tr style="background:#fefce8;border:2.5px solid #ca8a04">
                                  <td style="padding:10px 8px">
                                    <select id="edit-doc-nivel-${doc.id}" class="calif-filter-select" style="width:100%;font-size:0.86rem;font-weight:700;padding:8px 10px;min-height:38px;border-radius:6px">
                                      ${nivelesCategorias.map(n => `<option value="${escapeHTML(n)}" ${n.toLowerCase() === (doc.nivel || nivCat).toLowerCase() ? 'selected' : ''}>${escapeHTML(n)}</option>`).join('')}
                                    </select>
                                  </td>
                                  <td style="padding:10px 8px">
                                    <input type="text" id="edit-doc-titulo-${doc.id}" class="calif-filter-input" value="${escapeHTML(doc.titulo)}" placeholder="Tipo / Título..." style="width:100%;font-size:0.86rem;font-weight:700;padding:8px 10px;min-height:38px;border-radius:6px" required />
                                  </td>
                                  <td style="padding:10px 8px">
                                    <input type="url" id="edit-doc-enlace-${doc.id}" class="calif-filter-input" value="${escapeHTML(doc.enlace || '')}" placeholder="https://..." style="width:100%;font-size:0.86rem;padding:8px 10px;min-height:38px;border-radius:6px" />
                                  </td>
                                  <td style="padding:10px 8px">
                                    <input type="text" id="edit-doc-desc-${doc.id}" class="calif-filter-input" value="${escapeHTML(doc.desc || '')}" placeholder="Descripción breve..." style="width:100%;font-size:0.86rem;padding:8px 10px;min-height:38px;border-radius:6px" />
                                  </td>
                                  <td style="text-align:center;white-space:nowrap;padding:10px 8px">
                                    <div style="display:inline-flex;align-items:center;gap:6px">
                                      <button type="button" onclick="window.guardarEdicionDirectaDocente('${escapeHTML(docInfo.areaKey)}', '${escapeHTML(doc.id)}')" class="btn-calif btn-calif-publish" style="padding:8px 14px;font-size:0.82rem;font-weight:800;background:#15803d;color:#ffffff;border:none;border-radius:6px;display:inline-flex;align-items:center;gap:4px" title="Guardar cambios directamente en esta fila">
                                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                        <span>Guardar</span>
                                      </button>
                                      <button type="button" onclick="window.cancelarEdicionDirectaDocente()" class="btn-calif btn-calif-secondary" style="padding:8px 12px;font-size:0.82rem;font-weight:700;background:#e2e8f0;color:#334155;border:none;border-radius:6px" title="Cancelar edición">
                                        <span>Cancelar</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              `;
                            }
                            return `
                              <tr style="border-bottom:1px solid #f1f5f9">
                                <td style="font-weight:800;color:#063b17;font-size:0.80rem;padding:9px 10px">${escapeHTML(doc.nivel || nivCat)}</td>
                                <td style="font-weight:800;color:#0f172a;padding:9px 10px">${escapeHTML(doc.titulo)}</td>
                                <td style="padding:10px 10px">
                                  ${doc.enlace ? `
                                    <a href="${escapeHTML(doc.enlace)}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;font-weight:700;font-size:0.85rem;text-decoration:underline;display:inline-flex;align-items:center;gap:4px;word-break:break-all">
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                      <span>${escapeHTML(doc.enlace)}</span>
                                    </a>
                                  ` : `<span style="color:#94a3b8;font-size:0.84rem">-</span>`}
                                </td>
                                <td style="font-size:0.80rem;color:#475569;padding:9px 10px">${escapeHTML(doc.desc || '-')}</td>
                                <td style="text-align:center;white-space:nowrap;padding:9px 10px">
                                  <button type="button" onclick="window.editarDocumentoNivelDocente('${escapeHTML(docInfo.areaKey)}', '${escapeHTML(doc.id)}')" style="background:none;border:none;color:#0284c7;cursor:pointer;padding:4px" title="Editar directamente en esta fila">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  </button>
                                  <button type="button" onclick="window.eliminarDocumentoNivelDocente('${escapeHTML(docInfo.areaKey)}', '${escapeHTML(doc.id)}')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px" title="Eliminar documento">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                  </button>
                                </td>
                              </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
      return;
    }

    if (tabName === 'malla') {
      const areasTec = (typeof lsGet === 'function') ? lsGet('cea_areas_tec', (typeof AREAS_TEC_DEFAULT !== 'undefined' ? AREAS_TEC_DEFAULT : [])) : [];
      let currentArea = areasTec.find(a => a.key === docInfo.areaKey);
      if (!currentArea && typeof buscarCarreraOficial === 'function') {
        currentArea = buscarCarreraOficial(docInfo.areaKey);
      }
      const nivelesTec = ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio I', 'Técnico Medio II'];
      const modoEdicion = Boolean(window._modoEdicionMallaDocente);

      stage.innerHTML = `
        <div class="calif-card" style="border-top:3.5px solid var(--verde);padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.06);margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:20px">
            <div>
              <h3 style="margin:0;color:var(--verde-dark);font-size:1.25rem;font-weight:900;display:flex;align-items:center;gap:8px">
                ${getSvgIcon('BOOK')} Malla Curricular Oficial (20 Módulos) — ${escapeHTML(nombreEspecialidad)}
              </h3>
              <p style="margin:4px 0 0 0;font-size:0.83rem;color:var(--text-sec)">
                Estructura formativa de 20 módulos ministeriales (5 módulos por nivel) con carga horaria oficial.
              </p>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <button type="button" class="btn-calif ${modoEdicion ? 'btn-calif-secondary' : 'btn-calif-publish'}" onclick="window.toggleEdicionMallaDocente()" style="font-size:0.82rem;padding:7px 16px;font-weight:800;display:inline-flex;align-items:center;gap:6px">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span>${modoEdicion ? 'Cerrar Modo Edición' : 'Editar Malla Curricular'}</span>
              </button>
            </div>
          </div>

          <form onsubmit="window.guardarMallaCurricularDocente(event, '${escapeHTML(docInfo.areaKey)}')">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
              ${nivelesTec.map((nivNom, nivIdx) => {
                const mallaArr = (currentArea && Array.isArray(currentArea.malla)) ? currentArea.malla : [];
                const modulosDelNivel = (mallaArr[nivIdx] && Array.isArray(mallaArr[nivIdx].modulos)) ? mallaArr[nivIdx].modulos : [];
                const baseN = nivIdx * 5;
                const romanNumbers = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];

                return `
                  <div style="background:#ffffff;border:1.5px solid #063b17;border-radius:10px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,0.05);display:flex;flex-direction:column;justify-content:space-between">
                    <div>
                      <div style="background:#063b17;color:#ffffff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                        <h4 style="margin:0;color:#ffffff;font-size:0.98rem;font-weight:900">
                          Nivel ${nivIdx + 1}: ${escapeHTML(nivNom)}
                        </h4>
                        <span style="font-size:0.72rem;font-weight:900;background:rgba(255,255,255,0.22);color:#ffffff;padding:2px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.3)">
                          5 Módulos
                        </span>
                      </div>
                      <div style="padding:0 12px 12px 12px">

                      <div style="display:flex;flex-direction:column;gap:8px">
                        ${[1, 2, 3, 4, 5].map(m => {
                          const globalIdx = baseN + m - 1;
                          const modActual = modulosDelNivel[m - 1] || [];
                          const codDef = modActual[0] || `Módulo ${romanNumbers[globalIdx] || (globalIdx + 1)}`;
                          const nomDef = modActual[1] || `Contenido Formativo ${globalIdx + 1}`;

                          if (!modoEdicion) {
                            return `
                              <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px">
                                <div style="display:flex;align-items:center;gap:8px;overflow:hidden">
                                  <span style="background:#dcfce7;color:#166534;font-size:0.72rem;font-weight:900;padding:2px 6px;border-radius:4px;border:1px solid #86efac;white-space:nowrap">${escapeHTML(codDef)}</span>
                                  <span style="font-size:0.83rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHTML(nomDef)}">${escapeHTML(nomDef)}</span>
                                </div>
                                <span style="font-size:0.72rem;color:#64748b;font-weight:600;white-space:nowrap">Mód. ${globalIdx + 1}</span>
                              </div>
                            `;
                          }

                          return `
                            <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;display:grid;grid-template-columns:100px 1fr;gap:6px;align-items:center">
                              <input type="text" id="malla-cod-${nivIdx}-${m}" class="calif-filter-input" value="${escapeHTML(codDef)}" placeholder="Código" style="font-size:0.76rem;font-weight:700;padding:4px 6px" />
                              <input type="text" id="malla-nom-${nivIdx}-${m}" class="calif-filter-input" value="${escapeHTML(nomDef)}" placeholder="Nombre oficial..." style="font-size:0.78rem;font-weight:600;padding:4px 8px" />
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            ${modoEdicion ? `
              <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
                <button type="button" class="btn-calif btn-calif-secondary" onclick="window.toggleEdicionMallaDocente()">Cancelar</button>
                <button type="submit" class="btn-calif btn-calif-publish" style="padding:10px 24px;font-weight:800;font-size:0.88rem;display:inline-flex;align-items:center;gap:6px">
                  ${getSvgIcon('CHECK')}
                  <span>Guardar Malla Curricular (20 Módulos)</span>
                </button>
              </div>
            ` : ''}
          </form>
        </div>
      `;
      return;
    }

    // ── GESTIÓN DE HORARIOS OFICIALES: IDENTICO AL GESTOR CENTRAL DE LA PÁGINA PÚBLICA ──
    if (tabName === 'horarios') {
      // Horario técnico estructurado de 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
      const turnoTipo = tabActiva === 'humanistica' ? 'hum' : 'tec';
      let horarioHtml = '';
      if (typeof renderTablaMatrizParaSede === 'function') {
        horarioHtml = renderTablaMatrizParaSede('central', turnoTipo, false);
      }

      stage.innerHTML = `
        <div class="calif-card" style="border-top:3.5px solid var(--verde);padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.06);margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:2px solid #e2e8f0;padding-bottom:14px;margin-bottom:18px">
            <div>
              <h3 style="margin:0;color:var(--verde-dark);font-size:1.25rem;font-weight:900;display:flex;align-items:center;gap:8px">
                ${getSvgIcon('CLOCK')} Gestión de Horarios Oficiales — ${escapeHTML(nombreEspecialidad)}
              </h3>
              <p style="margin:4px 0 0 0;font-size:0.83rem;color:var(--text-sec)">
                Matriz horaria oficial sincronizada con la Dirección y la página web pública institucional.
              </p>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <button type="button" class="btn-calif btn-calif-primary" onclick="if(typeof imprimirHorarioActual==='function') imprimirHorarioActual('${turnoTipo}'); else window.print();" style="background:#063b17;color:#fff;border:none;padding:8px 18px;font-size:0.84rem;font-weight:800;display:inline-flex;align-items:center;gap:6px">
                ${getSvgIcon('PRINT')}
                <span>Imprimir Horario Oficial</span>
              </button>
            </div>
          </div>

          <div style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:10px;padding:16px;overflow-x:auto">
            ${horarioHtml || '<p style="text-align:center;color:#64748b">Cargando horario oficial...</p>'}
          </div>
        </div>
      `;
      return;
    }

    // ── PUBLICACIÓN DE AVISOS OFICIALES ──
    if (tabName === 'avisos') {
      const avisos = (typeof lsGet === 'function') ? lsGet('cea_actividades', []) : [];
      const avisosEsp = avisos.filter(a => a.categoria === 'Avisos' || a.carreraKey === docInfo.areaKey || a.autor === nombreEspecialidad);

      stage.innerHTML = `
        <div class="calif-card" style="border-top:3.5px solid var(--verde);padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.06);margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:2px solid #e2e8f0;padding-bottom:14px;margin-bottom:20px">
            <div>
              <h3 style="margin:0;color:var(--verde-dark);font-size:1.25rem;font-weight:900;display:flex;align-items:center;gap:8px">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                Publicación de Actividades Oficiales — ${escapeHTML(nombreEspecialidad)}
              </h3>
              <p style="margin:4px 0 0 0;font-size:0.83rem;color:var(--text-sec)">
                Emita y publique actividades curriculares y eventos institucionales que se difunden directamente en la sección «Galería y Actividades» de la especialidad y en el mural general del CEA.
              </p>
            </div>
            <span style="background:var(--verde-light);color:var(--verde-dark);font-size:0.80rem;font-weight:800;padding:4px 12px;border-radius:6px">
              Gestión ${escapeHTML(_gestionActiva)}
            </span>
          </div>

          <!-- FORMULARIO DE NUEVO AVISO -->
          <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:22px">
            <h4 style="margin:0 0 14px 0;font-size:0.92rem;color:var(--verde-dark);font-weight:900">+ Redactar Nuevo Aviso o Comunicado</h4>
            <form onsubmit="window.publicarAvisoDocente(event, { areaKey: '${escapeHTML(docInfo.areaKey)}', nombre: '${escapeHTML(nombreEspecialidad)}' })">
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:12px">
                <div>
                  <label style="display:block;font-size:0.80rem;font-weight:700;color:#334155;margin-bottom:4px">Título del Comunicado *</label>
                  <input type="text" id="aviso-doc-titulo" class="calif-filter-input" placeholder="Ej: Presentación de Proyectos Finales" required style="width:100%" />
                </div>
                <div>
                  <label style="display:block;font-size:0.80rem;font-weight:700;color:#334155;margin-bottom:4px">Nivel / Destinatarios *</label>
                  <select id="aviso-doc-categoria" class="calif-filter-select" style="width:100%">
                    <option value="Avisos">Todos los Niveles de la Especialidad</option>
                    <option value="Técnico Básico">Técnico Básico</option>
                    <option value="Técnico Auxiliar">Técnico Auxiliar</option>
                    <option value="Técnico Medio I">Técnico Medio I</option>
                    <option value="Técnico Medio II">Técnico Medio II</option>
                  </select>
                </div>
                <div>
                  <label style="display:block;font-size:0.80rem;font-weight:700;color:#334155;margin-bottom:4px">Fecha de Publicación</label>
                  <input type="date" id="aviso-doc-fecha" class="calif-filter-input" value="${new Date().toISOString().split('T')[0]}" style="width:100%" />
                </div>
              </div>

              <div style="margin-bottom:14px">
                <label style="display:block;font-size:0.80rem;font-weight:700;color:#334155;margin-bottom:4px">Contenido Detallado del Aviso *</label>
                <textarea id="aviso-doc-desc" class="calif-filter-input" rows="3" placeholder="Escriba las instrucciones, fechas límites o requisitos..." required style="width:100%;font-family:inherit"></textarea>
              </div>

              <div style="display:flex;justify-content:flex-end">
                <button type="submit" class="btn-calif btn-calif-publish" style="font-weight:800;padding:9px 20px;font-size:0.84rem;display:inline-flex;align-items:center;gap:6px">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  <span>Publicar Aviso Oficial</span>
                </button>
              </div>
            </form>
          </div>

          <!-- LISTA DE AVISOS PUBLICADOS -->
          <h4 style="margin:0 0 12px 0;font-size:0.92rem;color:#0f172a;font-weight:900">Avisos Emitidos Recientes (${avisosEsp.length})</h4>
          ${avisosEsp.length === 0 ? `
            <p style="margin:0;color:#94a3b8;font-size:0.84rem;font-style:italic">No hay avisos publicados recientemente para esta especialidad.</p>
          ` : `
            <div style="display:flex;flex-direction:column;gap:10px">
              ${avisosEsp.map(av => `
                <div style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <strong style="color:#0f172a;font-size:0.90rem">${escapeHTML(av.titulo)}</strong>
                      <span style="background:#f1f5f9;color:#475569;font-size:0.72rem;font-weight:800;padding:2px 8px;border-radius:10px">${escapeHTML(av.categoria || 'Aviso')}</span>
                      <span style="color:#94a3b8;font-size:0.75rem">${escapeHTML(av.fecha || '')}</span>
                    </div>
                    <p style="margin:0;font-size:0.82rem;color:#475569;line-height:1.4">${escapeHTML(av.descripcion || '')}</p>
                  </div>
                  <button type="button" onclick="window.eliminarAvisoDocente('${escapeHTML(av.id)}')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px" title="Eliminar aviso">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
      return;
    }

    // ── VISTA POR DEFECTO: 'subir_notas' (NIVELES Y PLANILLA DESPLEGADOS AUTOMÁTICAMENTE) ──
    const nivelDefInicial = tabActiva === 'humanistica' ? 'Aprendizajes Elementales' : 'Técnico Básico';
    if (!_nivelActivoDocente) {
      _nivelActivoDocente = nivelDefInicial;
    }
    stage.innerHTML = `
      <!-- CONTENEDOR DE CURSOS / NIVELES (4 TARJETAS CON MÓDULOS Y ESTADOS) -->
      <div id="docente-cursos-container" style="display:block"></div>

      <!-- ESPACIO DE LA PLANILLA DE NOTAS (SÓLO CUANDO SE ABRE UN MÓDULO) -->
      <div id="docente-planilla-container" style="display:none;margin-top:16px"></div>
    `;

    renderCursosDocenteSimplificado(tabActiva);
  }
  