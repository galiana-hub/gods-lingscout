let todosPartidos = [];
let todosAnalisisJugador = [];

(async () => {
  const { data: sesion } = await supabaseClient.auth.getSession();
  if (!sesion.session) { window.location.href = 'index.html'; return; }
  await cargarDatos();
})();

document.querySelectorAll('.logout-trigger').forEach(btn => {
  btn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });
});

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

async function cargarDatos() {
  const [partidos, jugadores] = await Promise.all([
    supabaseClient.from('analisis_partido').select('temporada, competicion, equipo_local, equipo_visitante'),
    supabaseClient.from('analisis_jugador').select('temporada, competicion, equipo, jugador_nombre, nota, goles, asistencias')
  ]);

  todosPartidos = partidos.data || [];
  todosAnalisisJugador = jugadores.data || [];

  const temporadas = new Set();
  todosPartidos.forEach(p => temporadas.add(p.temporada));
  todosAnalisisJugador.forEach(a => temporadas.add(a.temporada));

  const select = document.getElementById('selector-temporada');
  select.innerHTML = '';

  if (temporadas.size === 0) {
    document.getElementById('revision-contenido').hidden = true;
    const vacio = document.getElementById('revision-vacio');
    vacio.textContent = t('ui.revSinAnalisis');
    vacio.hidden = false;
    return;
  }

  const ordenadas = [...temporadas].sort().reverse();
  ordenadas.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => calcularRevision(select.value));
  calcularRevision(ordenadas[0]);
}

function contar(lista) {
  const conteo = {};
  lista.forEach(v => { if (v) conteo[v] = (conteo[v] || 0) + 1; });
  return conteo;
}

function masFrecuente(conteo) {
  let mejor = null;
  Object.entries(conteo).forEach(([clave, n]) => {
    if (!mejor || n > mejor.n) mejor = { clave, n };
  });
  return mejor;
}

function calcularRevision(temporada) {
  const partidos = todosPartidos.filter(p => p.temporada === temporada);
  const analisis = todosAnalisisJugador.filter(a => a.temporada === temporada);

  const contenido = document.getElementById('revision-contenido');
  const vacio = document.getElementById('revision-vacio');

  if (partidos.length === 0 && analisis.length === 0) {
    contenido.hidden = true;
    vacio.textContent = t('ui.revSinTemporada');
    vacio.hidden = false;
    return;
  }
  contenido.hidden = false;
  vacio.hidden = true;

  document.getElementById('rev-partidos').textContent = partidos.length;
  document.getElementById('rev-jugadores').textContent = analisis.length;
  document.getElementById('rev-goles').textContent = analisis.reduce((s, a) => s + (a.goles || 0), 0);
  document.getElementById('rev-asistencias').textContent = analisis.reduce((s, a) => s + (a.asistencias || 0), 0);

  // Top jugadores por nota media
  const porJugador = {};
  analisis.forEach(a => {
    if (a.nota === null || a.nota === undefined) return;
    if (!porJugador[a.jugador_nombre]) porJugador[a.jugador_nombre] = { suma: 0, n: 0 };
    porJugador[a.jugador_nombre].suma += a.nota;
    porJugador[a.jugador_nombre].n += 1;
  });

  const ranking = Object.entries(porJugador)
    .map(([nombre, d]) => ({ nombre, media: d.suma / d.n, n: d.n }))
    .sort((a, b) => b.media - a.media || b.n - a.n)
    .slice(0, 3);

  const topCont = document.getElementById('rev-top-jugadores');
  topCont.innerHTML = '';
  if (ranking.length === 0) {
    topCont.innerHTML = `<p class="empty-message">${t('ui.revSinNotas')}</p>`;
  } else {
    ranking.forEach((j, i) => {
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `
        <div class="result-card-header" style="cursor:default;">
          <div>
            <p class="result-title">${i + 1}. <a class="player-link" href="ficha.html?jugador=${encodeURIComponent(j.nombre)}">${escapar(j.nombre)}</a></p>
            <p class="result-subtitle">${j.n} ${pluralAnalisis(j.n)}</p>
          </div>
          <p class="stat-number" style="font-size:1.2rem;">${j.media.toFixed(1)}</p>
        </div>
      `;
      topCont.appendChild(card);
    });
  }

  // Datos destacados
  const jugadorTop = masFrecuente(contar(analisis.map(a => a.jugador_nombre)));
  document.getElementById('rev-jugador-mas-analizado').textContent =
    jugadorTop ? `${jugadorTop.clave} (${jugadorTop.n})` : '—';

  const equipos = [
    ...partidos.flatMap(p => [p.equipo_local, p.equipo_visitante]),
    ...analisis.map(a => a.equipo)
  ];
  const equipoTop = masFrecuente(contar(equipos));
  document.getElementById('rev-equipo-mas-analizado').textContent =
    equipoTop ? `${equipoTop.clave} (${equipoTop.n})` : '—';

  const competiciones = [...partidos.map(p => p.competicion), ...analisis.map(a => a.competicion)];
  const compTop = masFrecuente(contar(competiciones));
  document.getElementById('rev-competicion-top').textContent =
    compTop ? `${compTop.clave} (${compTop.n})` : '—';
}
