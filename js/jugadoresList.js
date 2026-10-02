let todosLosAnalisis = [];

(async () => {
  const { data: sesion } = await supabaseClient.auth.getSession();
  if (!sesion.session) { window.location.href = 'index.html'; return; }
  cargarAnalisis();
})();

document.querySelectorAll('.logout-trigger').forEach(btn => {
  btn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });
});

async function cargarAnalisis() {
  const { data, error } = await supabaseClient
    .from('analisis_jugador')
    .select('*')
    .order('creado_en', { ascending: false });

  const contenedor = document.getElementById('lista-jugadores');

  if (error) {
    contenedor.innerHTML = `<p class="empty-message">${t('ui.errorCargar')} ${error.message}</p>`;
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
  const busqueda = document.getElementById('filtro-busqueda').value.trim().toLowerCase();

  const filtrados = todosLosAnalisis.filter(a => {
    if (competicion && a.competicion !== competicion) return false;
    if (temporada && a.temporada !== temporada) return false;
    if (equipo && a.equipo !== equipo) return false;

    if (busqueda) {
      const textoCompleto = [
        a.jugador_nombre, a.equipo, a.competicion, a.impresiones,
        (a.etiquetas || []).join(' ')
      ].join(' ').toLowerCase();
      if (!textoCompleto.includes(busqueda)) return false;
    }

    return true;
  });

  renderizarLista(filtrados);
}

document.getElementById('filtro-busqueda').addEventListener('input', aplicarFiltros);

document.getElementById('filtro-competicion').addEventListener('change', aplicarFiltros);
document.getElementById('filtro-temporada').addEventListener('change', aplicarFiltros);
document.getElementById('filtro-equipo').addEventListener('change', aplicarFiltros);
document.getElementById('limpiar-filtros').addEventListener('click', () => {
  document.getElementById('filtro-competicion').value = '';
  document.getElementById('filtro-temporada').value = '';
  document.getElementById('filtro-equipo').value = '';
  document.getElementById('filtro-busqueda').value = '';
  renderizarLista(todosLosAnalisis);
});

function renderizarLista(analisis) {
  const contenedor = document.getElementById('lista-jugadores');
  contenedor.innerHTML = '';

  if (analisis.length === 0) {
    contenedor.innerHTML = `<p class="empty-message">${t('ui.sinResultados')}</p>`;
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
        <p class="result-subtitle">${a.competicion} · ${a.temporada} · ${t('ui.nota')}: ${a.nota ?? '—'}/10</p>
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

    const btnBorrar = detail.querySelector('.btn-delete');
    btnBorrar.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (!confirm(t('ui.confirmBorrar'))) return;
      const { error } = await supabaseClient.from('analisis_jugador').delete().eq('id', a.id);
      if (error) {
        alert(t('ui.errorBorrar') + ' ' + error.message);
        return;
      }
      todosLosAnalisis = todosLosAnalisis.filter(x => x.id !== a.id);
      aplicarFiltros();
    });

    detail.querySelector('.detail-actions').addEventListener('click', (ev) => ev.stopPropagation());
  });
}

function construirDetalleJugador(a) {
  let html = `
    <div class="detail-actions">
      <a href="jugador.html?id=${a.id}" class="btn-secondary">${t('ui.editar')}</a>
      <button type="button" class="btn-secondary btn-delete" data-id="${a.id}">${t('ui.borrar')}</button>
    </div>
  `;
  html += `
    <div class="detail-grid">
      <div>
        <p class="detail-label">${t('ui.goles')}</p>
        <p>${a.goles}</p>
      </div>
      <div>
        <p class="detail-label">${t('ui.asistencias')}</p>
        <p>${a.asistencias}</p>
      </div>
    </div>
  `;

  if (a.tendencia) {
    html += `<p class="detail-label">${t('jf.tendencia')}</p><p><span class="trend-badge ${claseTendencia(a.tendencia)}">${etiquetaTendencia(a.tendencia)}</span></p>`;
  }
  if (a.importancia) {
    html += `<p class="detail-label">${t('jf.importancia')}</p><p>${etiquetaImportancia(a.importancia)}</p>`;
  }
  if (a.punto_debil) {
    html += `<p class="detail-label">${t('jf.puntoDebil')}</p><p>${a.punto_debil}</p>`;
  }
  if (a.pie_dominante) {
    html += `<p class="detail-label">${t('jf.pie')}</p><p>${etiquetaPie(a.pie_dominante)}</p>`;
  }
  if (a.potencial) {
    html += `<p class="detail-label">${t('jf.potencial')}</p><p>${etiquetaPotencial(a.potencial)}</p>`;
  }
  if (a.resistencia) {
    html += `<p class="detail-label">${t('jf.resistencia')}</p><p>${etiquetaResistencia(a.resistencia)}</p>`;
  }
  if (a.impresiones) {
    html += `<p class="detail-label">${t('ui.impresiones')}</p><p>${a.impresiones}</p>`;
  }
  if (a.minuto) {
    html += `<p class="detail-label">${t('pf.minuto')}</p><p>${a.minuto}'</p>`;
  }
  if (a.acciones_clave && a.acciones_clave.length) {
    html += `<p class="detail-label">${t('jf.acciones')}</p>${htmlAcciones(a.acciones_clave)}`;
  }
  if (a.etiquetas && a.etiquetas.length) {
    html += `<p class="detail-label">${t('ui.etiquetas')}</p>${htmlTags(a.etiquetas)}`;
  }
  if (a.dibujo) {
    html += `<p class="detail-label">${t('ui.dibujo')}</p><img src="${a.dibujo}" class="detail-drawing">`;
  }
  if (a.posicion_x !== null && a.posicion_x !== undefined) {
    const cx = (parseFloat(a.posicion_x) / 100) * 300;
    const cy = (parseFloat(a.posicion_y) / 100) * 450;
    html += `
      <p class="detail-label">${t('pf.posicionMedia')}</p>
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
