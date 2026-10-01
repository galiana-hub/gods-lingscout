// ---------- Protección de la página + detectar modo edición ----------
let currentUserId = null;
const params = new URLSearchParams(window.location.search);
const editId = params.get('id');

(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'index.html';
    return;
  }
  currentUserId = data.session.user.id;
  await cargarSugerenciasJugadores();
  inicializarAlineaciones();

  if (editId) {
    document.querySelector('.form-page h2').textContent = t('ui.editarPartido');
    document.querySelector('.btn-submit').textContent = t('ui.guardarCambios');
    await cargarDatosExistentes(editId);
  }
})();

document.querySelectorAll('.logout-trigger').forEach(btn => {
  btn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });
});

// ---------- Cargar sugerencias de jugadores ya usados ----------
async function cargarSugerenciasJugadores() {
  const { data, error } = await supabaseClient.from('jugadores').select('nombre').order('nombre');
  if (error || !data) return;
  const datalist = document.getElementById('jugadores-list');
  datalist.innerHTML = '';
  data.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.nombre;
    datalist.appendChild(opt);
  });
}

// ---------- Actualizar etiquetas dinámicas con los nombres de los equipos ----------
const equipoLocalInput = document.getElementById('equipo-local');
const equipoVisitanteInput = document.getElementById('equipo-visitante');

function actualizarNombresEquipos() {
  const local = equipoLocalInput.value || 'Local';
  const visitante = equipoVisitanteInput.value || 'Visitante';
  document.getElementById('posesion-label-local').textContent = local;
  document.getElementById('posesion-label-visitante').textContent = visitante;
  document.getElementById('sistema-local-heading').textContent = local;
  document.getElementById('sistema-visitante-heading').textContent = visitante;
  document.getElementById('clave-local-heading').textContent = local;
  document.getElementById('clave-visitante-heading').textContent = visitante;
  document.getElementById('alineacion-local-heading').textContent = local;
  document.getElementById('alineacion-visitante-heading').textContent = visitante;
}
equipoLocalInput.addEventListener('input', actualizarNombresEquipos);
equipoVisitanteInput.addEventListener('input', actualizarNombresEquipos);

// ---------- Alineación: generar 11 filas por equipo ----------
function crearFilaJugador(team, index, esTitular = true) {
  const row = document.createElement('div');
  row.className = 'lineup-row';
  row.dataset.team = team;
  row.dataset.posX = '';
  row.dataset.posY = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.setAttribute('list', 'jugadores-list');
  input.placeholder = esTitular ? `${t('ui.jugador')} ${index + 1}` : t('ui.cambioPh');
  input.dataset.suplente = esTitular ? '' : '1';
  input.className = 'lineup-input';

  const posBtn = document.createElement('button');
  posBtn.type = 'button';
  posBtn.className = 'btn-position';
  posBtn.title = t('ui.marcarPosicion');
  posBtn.textContent = '📍';
  posBtn.addEventListener('click', () => abrirModalPosicion(row, input));

  const badge = document.createElement('span');
  badge.className = 'position-badge';
  badge.hidden = true;
  badge.textContent = '✓';

  row.appendChild(input);
  row.appendChild(posBtn);
  row.appendChild(badge);
  return row;
}

function inicializarAlineaciones() {
  const localList = document.getElementById('lineup-local');
  const visitanteList = document.getElementById('lineup-visitante');
  for (let i = 0; i < 11; i++) {
    localList.appendChild(crearFilaJugador('local', i, true));
    visitanteList.appendChild(crearFilaJugador('visitante', i, true));
  }
}

document.querySelectorAll('.btn-link[data-team]').forEach(btn => {
  btn.addEventListener('click', () => {
    const team = btn.dataset.team;
    const list = document.getElementById('lineup-' + team);
    const row = crearFilaJugador(team, list.children.length, false);
    list.appendChild(row);
  });
});

function rellenarFila(row, jugador) {
  const input = row.querySelector('.lineup-input');
  input.value = jugador.jugador_nombre;
  if (jugador.posicion_x !== null && jugador.posicion_x !== undefined) {
    row.dataset.posX = jugador.posicion_x;
    row.dataset.posY = jugador.posicion_y;
    row.querySelector('.position-badge').hidden = false;
  }
}

// ---------- Modal de posición media ----------
const modal = document.getElementById('position-modal');
const pitchSvg = document.getElementById('pitch-svg');
const pitchMarker = document.getElementById('pitch-marker');
let filaActiva = null;
let posTemporal = null;

function abrirModalPosicion(row, input) {
  if (!input.value.trim()) {
    alert(t('ui.nombreJugadorPrimero'));
    return;
  }
  filaActiva = row;
  document.getElementById('modal-player-name').textContent = input.value;

  if (row.dataset.posX && row.dataset.posY) {
    pitchMarker.setAttribute('cx', (row.dataset.posX / 100) * 300);
    pitchMarker.setAttribute('cy', (row.dataset.posY / 100) * 450);
    posTemporal = { x: parseFloat(row.dataset.posX), y: parseFloat(row.dataset.posY) };
  } else {
    pitchMarker.setAttribute('cx', -10);
    pitchMarker.setAttribute('cy', -10);
    posTemporal = null;
  }

  modal.hidden = false;
}

pitchSvg.addEventListener('click', (e) => {
  const rect = pitchSvg.getBoundingClientRect();
  const xPix = e.clientX - rect.left;
  const yPix = e.clientY - rect.top;
  const xPct = Math.min(100, Math.max(0, (xPix / rect.width) * 100));
  const yPct = Math.min(100, Math.max(0, (yPix / rect.height) * 100));

  pitchMarker.setAttribute('cx', (xPct / 100) * 300);
  pitchMarker.setAttribute('cy', (yPct / 100) * 450);
  posTemporal = { x: xPct, y: yPct };
});

document.getElementById('modal-cancel').addEventListener('click', () => {
  modal.hidden = true;
  filaActiva = null;
});

document.getElementById('modal-save').addEventListener('click', () => {
  if (posTemporal && filaActiva) {
    filaActiva.dataset.posX = posTemporal.x.toFixed(1);
    filaActiva.dataset.posY = posTemporal.y.toFixed(1);
    filaActiva.querySelector('.position-badge').hidden = false;
  }
  modal.hidden = true;
  filaActiva = null;
});

// ---------- Herramienta de dibujo táctico ----------
const drawingTool = DrawingTool.init('drawing-canvas', '.drawing-toolbar');
document.getElementById('clear-canvas').addEventListener('click', () => drawingTool.clear());

// ---------- Cargar datos existentes (modo edición) ----------
async function cargarDatosExistentes(id) {
  const { data: p, error } = await supabaseClient
    .from('analisis_partido')
    .select('*, alineacion_partido(*)')
    .eq('id', id)
    .single();

  if (error || !p) {
    document.getElementById('form-message').textContent = t('ui.errorCargarEditar');
    document.getElementById('form-message').classList.add('error');
    return;
  }

  document.getElementById('competicion').value = p.competicion || '';
  document.getElementById('temporada').value = p.temporada || '';
  document.getElementById('tipo-eliminatoria').value = p.tipo_eliminatoria || '';
  equipoLocalInput.value = p.equipo_local || '';
  equipoVisitanteInput.value = p.equipo_visitante || '';
  actualizarNombresEquipos();

  document.getElementById('goles-local').value = p.goles_local;
  document.getElementById('goles-visitante').value = p.goles_visitante;
  document.getElementById('marcador-1p').value = p.marcador_1parte || '';
  document.getElementById('marcador-2p').value = p.marcador_2parte || '';

  if (p.posesion) {
    const valor = p.posesion === p.equipo_local ? 'local' : 'visitante';
    const radio = document.querySelector(`input[name="posesion"][value="${valor}"]`);
    if (radio) radio.checked = true;
  }

  document.getElementById('sistema-local-con').value = p.sistema_local_con_balon || '';
  document.getElementById('sistema-local-sin').value = p.sistema_local_sin_balon || '';
  document.getElementById('sistema-visitante-con').value = p.sistema_visitante_con_balon || '';
  document.getElementById('sistema-visitante-sin').value = p.sistema_visitante_sin_balon || '';

  document.getElementById('clave-local').value = p.jugador_clave_local || '';
  document.getElementById('clave-visitante').value = p.jugador_clave_visitante || '';

  document.getElementById('cambio-tactico').value = p.cambio_tactico || '';
  document.getElementById('minuto').value = p.minuto || '';
  document.getElementById('etiquetas').value = (p.etiquetas || []).join(', ');

  if (p.dibujo) {
    drawingTool.loadImage(p.dibujo);
  }

  // Alineación
  const alineacion = p.alineacion_partido || [];
  ['local', 'visitante'].forEach(team => {
    const titulares = alineacion.filter(a => a.equipo === team && a.titular);
    const cambios = alineacion.filter(a => a.equipo === team && !a.titular);
    const filasBase = document.querySelectorAll(`#lineup-${team} .lineup-row`);

    titulares.forEach((jugador, i) => {
      if (filasBase[i]) {
        rellenarFila(filasBase[i], jugador);
      } else {
        const nuevaFila = crearFilaJugador(team, i, true);
        document.getElementById('lineup-' + team).appendChild(nuevaFila);
        rellenarFila(nuevaFila, jugador);
      }
    });

    cambios.forEach(jugador => {
      const nuevaFila = crearFilaJugador(team, 0, false);
      document.getElementById('lineup-' + team).appendChild(nuevaFila);
      rellenarFila(nuevaFila, jugador);
    });
  });
}

// ---------- Guardar en Supabase al enviar el formulario ----------
document.getElementById('partido-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('form-message');
  msg.textContent = '';
  msg.className = 'form-message';

  const posesionSeleccionada = document.querySelector('input[name="posesion"]:checked');
  const equipoLocal = equipoLocalInput.value.trim();
  const equipoVisitante = equipoVisitanteInput.value.trim();

  const etiquetasRaw = document.getElementById('etiquetas').value.trim();
  const etiquetas = etiquetasRaw ? etiquetasRaw.split(',').map(t => t.trim()).filter(Boolean) : null;

  const dibujo = drawingTool.getDataURL();

  const datosAnalisis = {
    usuario_id: currentUserId,
    competicion: document.getElementById('competicion').value.trim(),
    temporada: document.getElementById('temporada').value.trim(),
    tipo_eliminatoria: document.getElementById('tipo-eliminatoria').value || null,
    equipo_local: equipoLocal,
    equipo_visitante: equipoVisitante,
    goles_local: parseInt(document.getElementById('goles-local').value, 10),
    goles_visitante: parseInt(document.getElementById('goles-visitante').value, 10),
    marcador_1parte: document.getElementById('marcador-1p').value.trim() || null,
    marcador_2parte: document.getElementById('marcador-2p').value.trim() || null,
    posesion: posesionSeleccionada ? (posesionSeleccionada.value === 'local' ? equipoLocal : equipoVisitante) : null,
    sistema_local_con_balon: document.getElementById('sistema-local-con').value.trim() || null,
    sistema_local_sin_balon: document.getElementById('sistema-local-sin').value.trim() || null,
    sistema_visitante_con_balon: document.getElementById('sistema-visitante-con').value.trim() || null,
    sistema_visitante_sin_balon: document.getElementById('sistema-visitante-sin').value.trim() || null,
    jugador_clave_local: document.getElementById('clave-local').value.trim() || null,
    jugador_clave_visitante: document.getElementById('clave-visitante').value.trim() || null,
    cambio_tactico: document.getElementById('cambio-tactico').value.trim() || null,
    minuto: document.getElementById('minuto').value ? parseInt(document.getElementById('minuto').value, 10) : null,
    etiquetas: etiquetas,
    dibujo: dibujo
  };

  let analisisId = editId;

  if (editId) {
    const { error: errorUpdate } = await supabaseClient
      .from('analisis_partido')
      .update(datosAnalisis)
      .eq('id', editId);

    if (errorUpdate) {
      msg.textContent = t('ui.errorGuardar') + ' ' + errorUpdate.message;
      msg.classList.add('error');
      return;
    }

    // Borramos la alineación anterior y la volvemos a insertar entera (más simple y fiable)
    await supabaseClient.from('alineacion_partido').delete().eq('analisis_partido_id', editId);
  } else {
    const { data: partidoGuardado, error: errorPartido } = await supabaseClient
      .from('analisis_partido')
      .insert(datosAnalisis)
      .select()
      .single();

    if (errorPartido) {
      msg.textContent = t('ui.errorGuardar') + ' ' + errorPartido.message;
      msg.classList.add('error');
      return;
    }
    analisisId = partidoGuardado.id;
  }

  // Guardar alineación
  const filas = document.querySelectorAll('.lineup-row');
  const nombresParaAutocompletar = new Set();

  for (const fila of filas) {
    const input = fila.querySelector('.lineup-input');
    const nombre = input.value.trim();
    if (!nombre) continue;

    const equipo = fila.dataset.team;
    const esCambio = input.dataset.suplente === '1';

    await supabaseClient.from('alineacion_partido').insert({
      analisis_partido_id: analisisId,
      usuario_id: currentUserId,
      equipo: equipo,
      jugador_nombre: nombre,
      titular: !esCambio,
      posicion_x: fila.dataset.posX || null,
      posicion_y: fila.dataset.posY || null
    });

    nombresParaAutocompletar.add(JSON.stringify({
      nombre,
      equipo_actual: equipo === 'local' ? equipoLocal : equipoVisitante
    }));
  }

  if (datosAnalisis.jugador_clave_local) {
    nombresParaAutocompletar.add(JSON.stringify({ nombre: datosAnalisis.jugador_clave_local, equipo_actual: equipoLocal }));
  }
  if (datosAnalisis.jugador_clave_visitante) {
    nombresParaAutocompletar.add(JSON.stringify({ nombre: datosAnalisis.jugador_clave_visitante, equipo_actual: equipoVisitante }));
  }

  for (const item of nombresParaAutocompletar) {
    const { nombre, equipo_actual } = JSON.parse(item);
    await supabaseClient.from('jugadores')
      .upsert({ usuario_id: currentUserId, nombre, equipo_actual }, { onConflict: 'usuario_id,nombre' });
  }

  msg.textContent = editId ? '¡Cambios guardados correctamente!' : '¡Análisis guardado correctamente!';
  msg.classList.add('success');

  setTimeout(() => { window.location.href = 'partidos.html'; }, 1200);
});
