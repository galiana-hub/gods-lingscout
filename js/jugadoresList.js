let todosLosAnalisis = [];

(async () => {
  const { data: sesion } = await supabaseClient.auth.getSession();
  if (!sesion.session) { window.location.href = 'index.html'; return; }
  cargarAnalisis();
})();

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
});

async function cargarAnalisis() {
  const { data, error } = await supabaseClient
    .from('analisis_jugador')
    .select('*')
    .order('creado_en', { ascending: false });

  const contenedor = document.getElementById('lista-jugadores');

  if (error) {
    contenedor.innerHTML = `<p class="empty-message">Error al cargar: ${error.message}</p>`;
    return;
  }

  todosLosAnalisis = data || [];
  poblarFiltros(todosLosAnalisis);
  renderizarLista(todosLosAnalisis);
}

function poblarFiltros(analisis) {
  const competiciones = new Set();
  const temporadas = new Set();
  const equipos = new Set();

  analisis.forEach(a => {
    competiciones.add(a.competicion);
    temporadas.add(a.temporada);
    equipos.add(a.equipo);
  });

  rellenarSelect('filtro-competicion', competiciones);
  rellenarSelect('filtro-temporada', temporadas);
  rellenarSelect('filtro-equipo', equipos);
}

function rellenarSelect(id, valores) {
  const select = document.getElementById(id);
  const actual = select.value;
  select.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  [...valores].sort().forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
  select.value = actual;
}

function aplicarFiltros() {
  const competicion = document.getElementById('filtro-competicion').value;
  const temporada = document.getElementById('filtro-temporada').value;
  const equipo = document.getElementById('filtro-equipo').value;

  const filtrados = todosLosAnalisis.filter(a => {
    if (competicion && a.competicion !== competicion) return false;
    if (temporada && a.temporada !== temporada) return false;
    if (equipo && a.equipo !== equipo) return false;
    return true;
  });

  renderizarLista(filtrados);
}

document.getElementById('filtro-competicion').addEventListener('change', aplicarFiltros);
document.getElementById('filtro-temporada').addEventListener('change', aplicarFiltros);
document.getElementById('filtro-equipo').addEventListener('change', aplicarFiltros);
document.getElementById('limpiar-filtros').addEventListener('click', () => {
  document.getElementById('filtro-competicion').value = '';
  document.getElementById('filtro-temporada').value = '';
  document.getElementById('filtro-equipo').value = '';
  renderizarLista(todosLosAnalisis);
});

function renderizarLista(analisis) {
  const contenedor = document.getElementById('lista-jugadores');
  contenedor.innerHTML = '';

  if (analisis.length === 0) {
    contenedor.innerHTML = '<p class="empty-message">No hay análisis que coincidan con estos filtros.</p>';
    return;
  }

  analisis.forEach(a => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const header = document.createElement('div');
    header.className = 'result-card-header';
    header.innerHTML = `
      <div>
        <p class="result-title"><a href="ficha.html?jugador=${encodeURIComponent(a.jugador_nombre)}" class="player-link" onclick="event.stopPropagation()">${a.jugador_nombre}</a> — ${a.equipo}</p>
        <p class="result-subtitle">${a.competicion} · ${a.temporada} · Nota: ${a.nota ?? '—'}/10</p>
      </div>
      <span class="expand-arrow">▾</span>
    `;

    const detail = document.createElement('div');
    detail.className = 'result-card-detail';
    detail.hidden = true;
    detail.innerHTML = construirDetalleJugador(a);

    header.addEventListener('click', () => {
      detail.hidden = !detail.hidden;
      header.querySelector('.expand-arrow').textContent = detail.hidden ? '▾' : '▴';
    });

    card.appendChild(header);
    card.appendChild(detail);
    contenedor.appendChild(card);
  });
}

function construirDetalleJugador(a) {
  let html = `
    <div class="detail-grid">
      <div>
        <p class="detail-label">Goles</p>
        <p>${a.goles}</p>
      </div>
      <div>
        <p class="detail-label">Asistencias</p>
        <p>${a.asistencias}</p>
      </div>
    </div>
  `;

  if (a.impresiones) {
    html += `<p class="detail-label">Impresiones</p><p>${a.impresiones}</p>`;
  }
  if (a.minuto) {
    html += `<p class="detail-label">Minuto</p><p>${a.minuto}'</p>`;
  }
  if (a.etiquetas && a.etiquetas.length) {
    html += `<p class="detail-label">Etiquetas</p><p>${a.etiquetas.join(', ')}</p>`;
  }
  if (a.dibujo) {
    html += `<p class="detail-label">Dibujo</p><img src="${a.dibujo}" class="detail-drawing">`;
  }
  if (a.posicion_x !== null && a.posicion_x !== undefined) {
    const cx = (parseFloat(a.posicion_x) / 100) * 300;
    const cy = (parseFloat(a.posicion_y) / 100) * 450;
    html += `
      <p class="detail-label">Posición media</p>
      <svg viewBox="0 0 300 450" class="mini-pitch">
        <rect x="2" y="2" width="296" height="446" fill="#F5F1EB" stroke="#111111" stroke-width="2"/>
        <line x1="2" y1="225" x2="298" y2="225" stroke="#111111" stroke-width="2"/>
        <circle cx="150" cy="225" r="45" fill="none" stroke="#111111" stroke-width="2"/>
        <rect x="70" y="2" width="160" height="60" fill="none" stroke="#111111" stroke-width="2"/>
        <rect x="70" y="388" width="160" height="60" fill="none" stroke="#111111" stroke-width="2"/>
        <circle cx="${cx}" cy="${cy}" r="7" fill="#111111"/>
      </svg>
    `;
  }

  return html;
}
