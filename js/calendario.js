let eventosPorDia = {};
let mesActual = new Date();
mesActual.setDate(1);

(async () => {
  const { data: sesion } = await supabaseClient.auth.getSession();
  if (!sesion.session) { window.location.href = 'index.html'; return; }
  await cargarEventos();
  renderizarCalendario();
})();

document.querySelectorAll('.logout-trigger').forEach(btn => {
  btn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });
});

async function cargarEventos() {
  const [partidos, jugadores] = await Promise.all([
    supabaseClient.from('analisis_partido').select('id, equipo_local, equipo_visitante, goles_local, goles_visitante, creado_en'),
    supabaseClient.from('analisis_jugador').select('id, jugador_nombre, equipo, creado_en')
  ]);

  eventosPorDia = {};

  (partidos.data || []).forEach(p => {
    const clave = new Date(p.creado_en).toDateString();
    if (!eventosPorDia[clave]) eventosPorDia[clave] = [];
    eventosPorDia[clave].push({
      tipo: 'partido',
      id: p.id,
      texto: `${p.equipo_local} ${p.goles_local}-${p.goles_visitante} ${p.equipo_visitante}`
    });
  });

  (jugadores.data || []).forEach(a => {
    const clave = new Date(a.creado_en).toDateString();
    if (!eventosPorDia[clave]) eventosPorDia[clave] = [];
    eventosPorDia[clave].push({
      tipo: 'jugador',
      id: a.id,
      texto: `${a.jugador_nombre} — ${a.equipo}`
    });
  });
}

function renderizarCalendario() {
  const nombreMes = mesActual.toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric' });
  document.getElementById('mes-actual-label').textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  [0, 1, 2, 3, 4, 5, 6].forEach(i => {
    const cabecera = document.createElement('div');
    cabecera.className = 'calendar-day-header';
    cabecera.textContent = t('cal.day' + i);
    grid.appendChild(cabecera);
  });

  const year = mesActual.getFullYear();
  const month = mesActual.getMonth();
  const primerDiaSemana = (new Date(year, month, 1).getDay() + 6) % 7; // lunes = 0
  const diasEnMes = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < primerDiaSemana; i++) {
    const vacio = document.createElement('div');
    vacio.className = 'calendar-cell calendar-cell-empty';
    grid.appendChild(vacio);
  }

  const hoy = new Date().toDateString();

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = new Date(year, month, dia);
    const clave = fecha.toDateString();
    const eventos = eventosPorDia[clave] || [];

    const celda = document.createElement('div');
    celda.className = 'calendar-cell';
    if (clave === hoy) celda.classList.add('calendar-cell-today');
    if (eventos.length > 0) celda.classList.add('calendar-cell-has-events');

    const numero = document.createElement('p');
    numero.className = 'calendar-cell-number';
    numero.textContent = dia;
    celda.appendChild(numero);

    if (eventos.length > 0) {
      const dots = document.createElement('div');
      dots.className = 'calendar-dots';
      const tienePartido = eventos.some(e => e.tipo === 'partido');
      const tieneJugador = eventos.some(e => e.tipo === 'jugador');
      if (tienePartido) dots.innerHTML += '<span class="calendar-dot dot-partido"></span>';
      if (tieneJugador) dots.innerHTML += '<span class="calendar-dot dot-jugador"></span>';
      celda.appendChild(dots);

      celda.addEventListener('click', () => mostrarDia(fecha, eventos));
    }

    grid.appendChild(celda);
  }
}

function mostrarDia(fecha, eventos) {
  const section = document.getElementById('dia-seleccionado-section');
  const titulo = document.getElementById('dia-seleccionado-titulo');
  const lista = document.getElementById('dia-seleccionado-lista');

  section.hidden = false;
  titulo.textContent = fecha.toLocaleDateString(currentLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  lista.innerHTML = '';

  eventos.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'result-card';
    const href = ev.tipo === 'partido' ? `partido.html?id=${ev.id}` : `jugador.html?id=${ev.id}`;
    const etiqueta = ev.tipo === 'partido' ? t('ui.partido') : t('ui.jugador');
    card.innerHTML = `
      <div class="result-card-header" style="cursor:default;">
        <div>
          <p class="result-title">${escaparHtml(ev.texto)}</p>
          <p class="result-subtitle">${etiqueta}</p>
        </div>
        <a href="${href}" class="btn-secondary">${t('ui.abrir')}</a>
      </div>
    `;
    lista.appendChild(card);
  });

  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('mes-anterior').addEventListener('click', () => {
  mesActual.setMonth(mesActual.getMonth() - 1);
  document.getElementById('dia-seleccionado-section').hidden = true;
  renderizarCalendario();
});
document.getElementById('mes-siguiente').addEventListener('click', () => {
  mesActual.setMonth(mesActual.getMonth() + 1);
  document.getElementById('dia-seleccionado-section').hidden = true;
  renderizarCalendario();
});
