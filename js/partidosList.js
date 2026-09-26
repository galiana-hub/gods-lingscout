let todosLosPartidos = [];

(async () => {
  const { data: sesion } = await supabaseClient.auth.getSession();
  if (!sesion.session) { window.location.href = 'index.html'; return; }
  cargarPartidos();
})();

document.querySelectorAll('.logout-trigger').forEach(btn => {
  btn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });
});

async function cargarPartidos() {
  const { data, error } = await supabaseClient
    .from('analisis_partido')
    .select('*, alineacion_partido(*)')
    .order('creado_en', { ascending: false });

  const contenedor = document.getElementById('lista-partidos');

  if (error) {
    contenedor.innerHTML = `<p class="empty-message">Error al cargar: ${error.message}</p>`;
    return;
  }

  todosLosPartidos = data || [];
  poblarFiltros(todosLosPartidos);
  renderizarLista(todosLosPartidos);
}

function poblarFiltros(partidos) {
  const competiciones = new Set();
  const temporadas = new Set();
  const equipos = new Set();

  partidos.forEach(p => {
    competiciones.add(p.competicion);
    temporadas.add(p.temporada);
    equipos.add(p.equipo_local);
    equipos.add(p.equipo_visitante);
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

  const filtrados = todosLosPartidos.filter(p => {
    if (competicion && p.competicion !== competicion) return false;
    if (temporada && p.temporada !== temporada) return false;
    if (equipo && p.equipo_local !== equipo && p.equipo_visitante !== equipo) return false;
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
  renderizarLista(todosLosPartidos);
});

function renderizarLista(partidos) {
  const contenedor = document.getElementById('lista-partidos');
  contenedor.innerHTML = '';

  if (partidos.length === 0) {
    contenedor.innerHTML = '<p class="empty-message">No hay análisis que coincidan con estos filtros.</p>';
    return;
  }

  partidos.forEach(p => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const header = document.createElement('div');
    header.className = 'result-card-header';
    header.innerHTML = `
      <div>
        <p class="result-title">${p.equipo_local} ${p.goles_local}-${p.goles_visitante} ${p.equipo_visitante}</p>
        <p class="result-subtitle">${p.competicion} · ${p.temporada}</p>
      </div>
      <span class="expand-arrow">▾</span>
    `;

    const detail = document.createElement('div');
    detail.className = 'result-card-detail';
    detail.hidden = true;
    detail.innerHTML = construirDetallePartido(p);

    header.addEventListener('click', () => {
      detail.hidden = !detail.hidden;
      header.querySelector('.expand-arrow').textContent = detail.hidden ? '▾' : '▴';
    });

    card.appendChild(header);
    card.appendChild(detail);
    contenedor.appendChild(card);

    const btnBorrar = detail.querySelector('.btn-delete');
    btnBorrar.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (!confirm('¿Seguro que quieres borrar este análisis? No se puede deshacer.')) return;
      const { error } = await supabaseClient.from('analisis_partido').delete().eq('id', p.id);
      if (error) {
        alert('Error al borrar: ' + error.message);
        return;
      }
      todosLosPartidos = todosLosPartidos.filter(x => x.id !== p.id);
      aplicarFiltros();
    });

    detail.querySelector('.detail-actions').addEventListener('click', (ev) => ev.stopPropagation());
  });
}

function construirDetallePartido(p) {
  const alineacionLocal = (p.alineacion_partido || []).filter(a => a.equipo === 'local');
  const alineacionVisitante = (p.alineacion_partido || []).filter(a => a.equipo === 'visitante');

  let html = `
    <div class="detail-actions">
      <a href="partido.html?id=${p.id}" class="btn-secondary">Editar</a>
      <button type="button" class="btn-secondary btn-delete" data-id="${p.id}">Borrar</button>
    </div>
  `;
  html += `
    <div class="detail-grid">
      <div>
        <p class="detail-label">Marcador por partes</p>
        <p>${p.marcador_1parte || '—'} / ${p.marcador_2parte || '—'}</p>
      </div>
      <div>
        <p class="detail-label">Posesión</p>
        <p>${p.posesion || '—'}</p>
      </div>
    </div>
    <div class="detail-grid">
      <div>
        <p class="detail-label">${p.equipo_local} — Sistema</p>
        <p>Con balón: ${p.sistema_local_con_balon || '—'}</p>
        <p>Sin balón: ${p.sistema_local_sin_balon || '—'}</p>
      </div>
      <div>
        <p class="detail-label">${p.equipo_visitante} — Sistema</p>
        <p>Con balón: ${p.sistema_visitante_con_balon || '—'}</p>
        <p>Sin balón: ${p.sistema_visitante_sin_balon || '—'}</p>
      </div>
    </div>
    <div class="detail-grid">
      <div>
        <p class="detail-label">Jugador clave ${p.equipo_local}</p>
        <p>${p.jugador_clave_local || '—'}</p>
      </div>
      <div>
        <p class="detail-label">Jugador clave ${p.equipo_visitante}</p>
        <p>${p.jugador_clave_visitante || '—'}</p>
      </div>
    </div>
  `;

  if (p.cambio_tactico) {
    html += `<p class="detail-label">Cambio táctico</p><p>${p.cambio_tactico}</p>`;
  }
  if (p.minuto) {
    html += `<p class="detail-label">Minuto</p><p>${p.minuto}'</p>`;
  }
  if (p.etiquetas && p.etiquetas.length) {
    html += `<p class="detail-label">Etiquetas</p><p>${p.etiquetas.join(', ')}</p>`;
  }
  if (p.dibujo) {
    html += `<p class="detail-label">Dibujo</p><img src="${p.dibujo}" class="detail-drawing">`;
  }

  html += `
    <div class="detail-grid">
      <div>
        <p class="detail-label">Alineación ${p.equipo_local}</p>
        ${renderizarAlineacion(alineacionLocal)}
      </div>
      <div>
        <p class="detail-label">Alineación ${p.equipo_visitante}</p>
        ${renderizarAlineacion(alineacionVisitante)}
      </div>
    </div>
  `;

  const conPosicion = (p.alineacion_partido || []).filter(a => a.posicion_x !== null && a.posicion_x !== undefined);
  if (conPosicion.length) {
    html += `<p class="detail-label">Posiciones medias</p>${renderizarMiniPitch(conPosicion)}`;
  }

  return html;
}

function renderizarAlineacion(jugadores) {
  if (!jugadores.length) return '<p class="detail-empty">—</p>';
  return '<ul class="lineup-view">' + jugadores.map(j =>
    `<li>${j.jugador_nombre}${j.titular ? '' : ' (cambio)'}${j.posicion_x !== null ? ' 📍' : ''}</li>`
  ).join('') + '</ul>';
}

function renderizarMiniPitch(jugadoresConPosicion) {
  const puntos = jugadoresConPosicion.map(j => {
    const cx = (parseFloat(j.posicion_x) / 100) * 300;
    const cy = (parseFloat(j.posicion_y) / 100) * 450;
    const inicial = j.jugador_nombre.split(' ')[0].slice(0, 8);
    return `<circle cx="${cx}" cy="${cy}" r="6" fill="#111111"/>
            <text x="${cx}" y="${cy - 10}" font-size="10" text-anchor="middle" fill="#111111">${inicial}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 300 450" class="mini-pitch">
      <rect x="2" y="2" width="296" height="446" fill="#F5F1EB" stroke="#111111" stroke-width="2"/>
      <line x1="2" y1="225" x2="298" y2="225" stroke="#111111" stroke-width="2"/>
      <circle cx="150" cy="225" r="45" fill="none" stroke="#111111" stroke-width="2"/>
      <rect x="70" y="2" width="160" height="60" fill="none" stroke="#111111" stroke-width="2"/>
      <rect x="70" y="388" width="160" height="60" fill="none" stroke="#111111" stroke-width="2"/>
      ${puntos}
    </svg>
  `;
}
