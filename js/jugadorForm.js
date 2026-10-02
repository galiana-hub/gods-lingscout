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
  await cargarTagsPrevias();

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

// ---------- Acciones clave (casillas opcionales) ----------
let accionesSeleccionadas = new Set();

function construirAcciones() {
  construirChipsToggle('acciones-clave', LINGSCOUT_ACCIONES, 'jf.acc_', accionesSeleccionadas);
}
construirAcciones();

// ---------- Etiquetas personalizables (#regateador, #líder...) ----------
const MAX_TAGS = 12;
let tags = [];
let tagsPrevias = [];   // etiquetas que el usuario ya ha usado en otros análisis

function agregarTag(raw) {
  const tag = normalizarTag(raw);
  if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return;
  tags.push(tag);
  renderTags();
}

function quitarTag(tag) {
  tags = tags.filter(x => x !== tag);
  renderTags();
}

function commitTagInput() {
  const input = document.getElementById('tags-input');
  if (input.value.trim()) agregarTag(input.value);
  input.value = '';
}

function renderTags() {
  const cont = document.getElementById('tags-chips');
  cont.innerHTML = '';
  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'chip chip-tag';
    chip.append('#' + tag);
    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'chip-remove';
    quitar.textContent = '×';
    quitar.setAttribute('aria-label', '#' + tag);
    quitar.addEventListener('click', () => quitarTag(tag));
    chip.appendChild(quitar);
    cont.appendChild(chip);
  });
  renderSugeridas();
}

function renderSugeridas() {
  const cont = document.getElementById('tags-sugeridas');
  cont.innerHTML = '';
  const candidatas = [...tagsPrevias, ...LINGSCOUT_TAGS_SUGERIDAS.map(k => normalizarTag(t('jf.tagSug_' + k)))];
  const vistas = new Set();
  candidatas.forEach(tag => {
    if (!tag || vistas.has(tag) || tags.includes(tag)) return;
    vistas.add(tag);
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'chip chip-tag chip-suggest';
    boton.textContent = '#' + tag;
    boton.addEventListener('click', () => agregarTag(tag));
    cont.appendChild(boton);
  });
}

async function cargarTagsPrevias() {
  const { data, error } = await supabaseClient
    .from('analisis_jugador').select('etiquetas').not('etiquetas', 'is', null).limit(300);
  if (error || !data) return;
  const cuenta = {};
  data.forEach(fila => (fila.etiquetas || []).forEach(x => {
    const tag = normalizarTag(x);
    if (tag) cuenta[tag] = (cuenta[tag] || 0) + 1;
  }));
  tagsPrevias = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]).slice(0, 12);
  renderSugeridas();
}

const tagsInput = document.getElementById('tags-input');
tagsInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    commitTagInput();
  } else if (e.key === 'Backspace' && !tagsInput.value && tags.length) {
    quitarTag(tags[tags.length - 1]);
  }
});
tagsInput.addEventListener('input', () => {
  if (tagsInput.value.includes(',')) {   // teclados móviles que no envían keydown de la coma
    tagsInput.value.split(',').forEach(parte => agregarTag(parte));
    tagsInput.value = '';
  }
});
tagsInput.addEventListener('blur', commitTagInput);
renderTags();

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
  document.getElementById('resistencia').value = a.resistencia || '';
  document.getElementById('pie-dominante').value = a.pie_dominante || '';
  document.getElementById('pierna-mala-habilidad').value = a.pierna_mala_habilidad || '';
  document.getElementById('potencial').value = a.potencial || '';
  document.getElementById('posicion-ideal').value = a.posicion_ideal || '';
  document.getElementById('punto-debil').value = a.punto_debil || '';
  document.getElementById('tendencia').value = a.tendencia || '';
  document.getElementById('importancia').value = a.importancia || '';
  document.getElementById('impresiones').value = a.impresiones || '';
  document.getElementById('como-recibe-orientacion').value = a.como_recibe_orientacion || '';
  document.getElementById('como-recibe-despues').value = a.como_recibe_despues || '';
  document.getElementById('como-recibe-progresa').value = a.como_recibe_progresa || '';
  document.getElementById('conductas-repetitivas').value = a.conductas_repetitivas || '';
  document.getElementById('minuto').value = a.minuto || '';
  accionesSeleccionadas = new Set(a.acciones_clave || []);
  construirAcciones();
  tags = (a.etiquetas || []).map(normalizarTag).filter(Boolean).slice(0, MAX_TAGS);
  renderTags();

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

  commitTagInput();
  const etiquetas = tags.length ? [...tags] : null;
  const accionesClave = LINGSCOUT_ACCIONES.filter(c => accionesSeleccionadas.has(c));

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
    resistencia: document.getElementById('resistencia').value || null,
    pie_dominante: document.getElementById('pie-dominante').value || null,
    pierna_mala_habilidad: document.getElementById('pierna-mala-habilidad').value || null,
    potencial: document.getElementById('potencial').value || null,
    posicion_ideal: document.getElementById('posicion-ideal').value || null,
    punto_debil: document.getElementById('punto-debil').value.trim() || null,
    tendencia: document.getElementById('tendencia').value || null,
    importancia: document.getElementById('importancia').value || null,
    impresiones: document.getElementById('impresiones').value.trim() || null,
    como_recibe_orientacion: document.getElementById('como-recibe-orientacion').value.trim() || null,
    como_recibe_despues: document.getElementById('como-recibe-despues').value.trim() || null,
    como_recibe_progresa: document.getElementById('como-recibe-progresa').value.trim() || null,
    conductas_repetitivas: document.getElementById('conductas-repetitivas').value.trim() || null,
    minuto: document.getElementById('minuto').value ? parseInt(document.getElementById('minuto').value, 10) : null,
    etiquetas: etiquetas,
    acciones_clave: accionesClave.length ? accionesClave : null,
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
