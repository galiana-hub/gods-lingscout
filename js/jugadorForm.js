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

  if (editId) {
    document.querySelector('.form-page h2').textContent = t('ui.editarJugador');
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

// ---------- Modal de posición media ----------
const modal = document.getElementById('position-modal');
const pitchSvg = document.getElementById('pitch-svg');
const pitchMarker = document.getElementById('pitch-marker');
let posGuardada = null;
let posTemporal = null;

document.getElementById('btn-posicion-media').addEventListener('click', () => {
  const nombre = document.getElementById('jugador-nombre').value.trim();
  if (!nombre) {
    alert(t('ui.nombreJugadorPrimero'));
    return;
  }
  document.getElementById('modal-player-name').textContent = nombre;

  if (posGuardada) {
    pitchMarker.setAttribute('cx', (posGuardada.x / 100) * 300);
    pitchMarker.setAttribute('cy', (posGuardada.y / 100) * 450);
    posTemporal = posGuardada;
  } else {
    pitchMarker.setAttribute('cx', -10);
    pitchMarker.setAttribute('cy', -10);
    posTemporal = null;
  }

  modal.hidden = false;
});

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
});

document.getElementById('modal-save').addEventListener('click', () => {
  if (posTemporal) {
    posGuardada = posTemporal;
    document.getElementById('posicion-badge').hidden = false;
  }
  modal.hidden = true;
});

// ---------- Herramienta de dibujo táctico ----------
const drawingTool = DrawingTool.init('drawing-canvas', '.drawing-toolbar');
document.getElementById('clear-canvas').addEventListener('click', () => drawingTool.clear());

// ---------- Cargar datos existentes (modo edición) ----------
async function cargarDatosExistentes(id) {
  const { data: a, error } = await supabaseClient
    .from('analisis_jugador')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !a) {
    document.getElementById('form-message').textContent = t('ui.errorCargarEditar');
    document.getElementById('form-message').classList.add('error');
    return;
  }

  document.getElementById('jugador-nombre').value = a.jugador_nombre || '';
  document.getElementById('equipo').value = a.equipo || '';
  document.getElementById('competicion').value = a.competicion || '';
  document.getElementById('temporada').value = a.temporada || '';
  document.getElementById('goles').value = a.goles;
  document.getElementById('asistencias').value = a.asistencias;
  document.getElementById('nota').value = a.nota || '';
  document.getElementById('impresiones').value = a.impresiones || '';
  document.getElementById('minuto').value = a.minuto || '';
  document.getElementById('etiquetas').value = (a.etiquetas || []).join(', ');

  if (a.dibujo) {
    drawingTool.loadImage(a.dibujo);
  }

  if (a.posicion_x !== null && a.posicion_x !== undefined) {
    posGuardada = { x: parseFloat(a.posicion_x), y: parseFloat(a.posicion_y) };
    document.getElementById('posicion-badge').hidden = false;
  }
}

// ---------- Guardar en Supabase ----------
document.getElementById('jugador-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('form-message');
  msg.textContent = '';
  msg.className = 'form-message';

  const nombre = document.getElementById('jugador-nombre').value.trim();
  const equipo = document.getElementById('equipo').value.trim();

  const etiquetasRaw = document.getElementById('etiquetas').value.trim();
  const etiquetas = etiquetasRaw ? etiquetasRaw.split(',').map(t => t.trim()).filter(Boolean) : null;

  const dibujo = drawingTool.getDataURL();

  const datosAnalisis = {
    usuario_id: currentUserId,
    jugador_nombre: nombre,
    equipo: equipo,
    competicion: document.getElementById('competicion').value.trim(),
    temporada: document.getElementById('temporada').value.trim(),
    goles: parseInt(document.getElementById('goles').value, 10) || 0,
    asistencias: parseInt(document.getElementById('asistencias').value, 10) || 0,
    nota: parseInt(document.getElementById('nota').value, 10),
    impresiones: document.getElementById('impresiones').value.trim() || null,
    minuto: document.getElementById('minuto').value ? parseInt(document.getElementById('minuto').value, 10) : null,
    etiquetas: etiquetas,
    dibujo: dibujo,
    posicion_x: posGuardada ? posGuardada.x.toFixed(1) : null,
    posicion_y: posGuardada ? posGuardada.y.toFixed(1) : null
  };

  let error;
  if (editId) {
    ({ error } = await supabaseClient.from('analisis_jugador').update(datosAnalisis).eq('id', editId));
  } else {
    ({ error } = await supabaseClient.from('analisis_jugador').insert(datosAnalisis));
  }

  if (error) {
    msg.textContent = t('ui.errorGuardar') + ' ' + error.message;
    msg.classList.add('error');
    return;
  }

  await supabaseClient.from('jugadores')
    .upsert({ usuario_id: currentUserId, nombre, equipo_actual: equipo }, { onConflict: 'usuario_id,nombre' });

  msg.textContent = editId ? '¡Cambios guardados correctamente!' : '¡Análisis guardado correctamente!';
  msg.classList.add('success');

  setTimeout(() => { window.location.href = 'jugadores.html'; }, 1200);
});
