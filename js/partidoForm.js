// ---------- Protección de la página ----------
let currentUserId = null;
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'index.html';
    return;
  }
  currentUserId = data.session.user.id;
  cargarSugerenciasJugadores();
})();

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
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
  input.placeholder = esTitular ? `Jugador ${index + 1}` : 'Cambio';
  input.className = 'lineup-input';

  const posBtn = document.createElement('button');
  posBtn.type = 'button';
  posBtn.className = 'btn-position';
  posBtn.title = 'Marcar posición media';
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
inicializarAlineaciones();

document.querySelectorAll('.btn-link[data-team]').forEach(btn => {
  btn.addEventListener('click', () => {
    const team = btn.dataset.team;
    const list = document.getElementById('lineup-' + team);
    const row = crearFilaJugador(team, list.children.length, false);
    list.appendChild(row);
  });
});

// ---------- Modal de posición media ----------
const modal = document.getElementById('position-modal');
const pitchSvg = document.getElementById('pitch-svg');
const pitchMarker = document.getElementById('pitch-marker');
let filaActiva = null;
let posTemporal = null;

function abrirModalPosicion(row, input) {
  if (!input.value.trim()) {
    alert('Escribe primero el nombre del jugador.');
    return;
  }
  filaActiva = row;
  document.getElementById('modal-player-name').textContent = input.value;

  // Si ya tenía posición guardada, mostrarla
  if (row.dataset.posX && row.dataset.posY) {
    pitchMarker.setAttribute('cx', row.dataset.posX * 3);
    pitchMarker.setAttribute('cy', row.dataset.posY * 4.5);
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
    const badge = filaActiva.querySelector('.position-badge');
    badge.hidden = false;
  }
  modal.hidden = true;
  filaActiva = null;
});

// ---------- Dibujo (canvas) ----------
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
let dibujando = false;

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function empezarDibujo(e) {
  dibujando = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}
function dibujar(e) {
  if (!dibujando) return;
  const pos = getPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2;
  ctx.stroke();
  e.preventDefault();
}
function terminarDibujo() { dibujando = false; }

canvas.addEventListener('mousedown', empezarDibujo);
canvas.addEventListener('mousemove', dibujar);
canvas.addEventListener('mouseup', terminarDibujo);
canvas.addEventListener('mouseleave', terminarDibujo);
canvas.addEventListener('touchstart', empezarDibujo);
canvas.addEventListener('touchmove', dibujar);
canvas.addEventListener('touchend', terminarDibujo);

document.getElementById('clear-canvas').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function canvasEstaVacio() {
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
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

  const dibujo = canvasEstaVacio() ? null : canvas.toDataURL('image/png');

  const nuevoAnalisis = {
    usuario_id: currentUserId,
    competicion: document.getElementById('competicion').value.trim(),
    temporada: document.getElementById('temporada').value.trim(),
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

  const { data: partidoGuardado, error: errorPartido } = await supabaseClient
    .from('analisis_partido')
    .insert(nuevoAnalisis)
    .select()
    .single();

  if (errorPartido) {
    msg.textContent = 'Error al guardar: ' + errorPartido.message;
    msg.classList.add('error');
    return;
  }

  // Guardar alineación
  const filas = document.querySelectorAll('.lineup-row');
  const nombresParaAutocompletar = new Set();

  for (const fila of filas) {
    const input = fila.querySelector('.lineup-input');
    const nombre = input.value.trim();
    if (!nombre) continue;

    const equipo = fila.dataset.team;
    const esCambio = input.placeholder === 'Cambio';

    await supabaseClient.from('alineacion_partido').insert({
      analisis_partido_id: partidoGuardado.id,
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

  // También guardar los jugadores clave para el autocompletado
  if (nuevoAnalisis.jugador_clave_local) {
    nombresParaAutocompletar.add(JSON.stringify({ nombre: nuevoAnalisis.jugador_clave_local, equipo_actual: equipoLocal }));
  }
  if (nuevoAnalisis.jugador_clave_visitante) {
    nombresParaAutocompletar.add(JSON.stringify({ nombre: nuevoAnalisis.jugador_clave_visitante, equipo_actual: equipoVisitante }));
  }

  for (const item of nombresParaAutocompletar) {
    const { nombre, equipo_actual } = JSON.parse(item);
    await supabaseClient.from('jugadores')
      .upsert({ usuario_id: currentUserId, nombre, equipo_actual }, { onConflict: 'usuario_id,nombre' });
  }

  msg.textContent = '¡Análisis guardado correctamente!';
  msg.classList.add('success');

  setTimeout(() => { window.location.href = 'app.html'; }, 1200);
});
