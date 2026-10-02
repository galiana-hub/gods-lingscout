let datosCompletos = [];
let chartNotas = null;
let chartGolesAsis = null;
let chartTendencia = null;

const VALOR_TENDENCIA = { bajando: -1, estancado: 0, mejorando: 1 };
const COLOR_TENDENCIA = { bajando: '#B3261E', estancado: '#8A8A82', mejorando: '#2E7D32' };
const CLAVE_TENDENCIA = { '-1': 'bajando', '0': 'estancado', '1': 'mejorando' };

// Historial de la tendencia: gráfico escalonado + línea de tiempo con los cambios
function renderHistorialTendencia(data) {
  const vacio = document.getElementById('tendencia-empty');
  const contenido = document.getElementById('tendencia-contenido');
  if (chartTendencia) { chartTendencia.destroy(); chartTendencia = null; }

  const conTendencia = data.filter(a => VALOR_TENDENCIA[a.tendencia] !== undefined);
  if (conTendencia.length === 0) {
    vacio.hidden = false;
    contenido.hidden = true;
    return;
  }
  vacio.hidden = true;
  contenido.hidden = false;

  const formato = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const ultima = conTendencia[conTendencia.length - 1];
  document.getElementById('tendencia-actual').innerHTML =
    `<span class="trend-badge ${claseTendencia(ultima.tendencia)}">${etiquetaTendencia(ultima.tendencia)}</span> ` +
    `<span class="result-subtitle">${new Date(ultima.creado_en).toLocaleDateString(currentLocale(), formato)}</span>`;

  chartTendencia = new Chart(document.getElementById('chart-tendencia'), {
    type: 'line',
    data: {
      labels: conTendencia.map(a => new Date(a.creado_en).toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit' })),
      datasets: [{
        data: conTendencia.map(a => VALOR_TENDENCIA[a.tendencia]),
        stepped: true,
        borderColor: '#8A8A82',
        backgroundColor: 'transparent',
        pointRadius: 6,
        pointBackgroundColor: conTendencia.map(a => COLOR_TENDENCIA[a.tendencia]),
        pointBorderColor: conTendencia.map(a => COLOR_TENDENCIA[a.tendencia])
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          min: -1.5, max: 1.5,
          ticks: { stepSize: 1, callback: v => ({ '-1': '↘', '0': '→', '1': '↗' }[String(v)] || '') }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => etiquetaTendencia(CLAVE_TENDENCIA[String(ctx.parsed.y)]) } }
      }
    }
  });

  // Línea de tiempo, de la más reciente a la más antigua; marca cuándo cambió
  const lista = document.getElementById('tendencia-lista');
  lista.innerHTML = '';
  const recientesPrimero = [...conTendencia].reverse();
  recientesPrimero.forEach((a, i) => {
    const anterior = recientesPrimero[i + 1];
    const cambio = anterior && anterior.tendencia !== a.tendencia
      ? ` · ${t('fi.tendAntes')}: ${etiquetaTendencia(anterior.tendencia)}` : '';
    const item = document.createElement('div');
    item.className = 'trend-item';
    item.innerHTML = `
      <span class="trend-badge ${claseTendencia(a.tendencia)}">${etiquetaTendencia(a.tendencia)}</span>
      <div>
        <p class="result-title">${new Date(a.creado_en).toLocaleDateString(currentLocale(), formato)}</p>
        <p class="result-subtitle">${escaparHtml(a.equipo)} · ${escaparHtml(a.competicion)}${cambio}</p>
      </div>`;
    lista.appendChild(item);
  });
}

(async () => {
  const { data: sesion } = await supabaseClient.auth.getSession();
  if (!sesion.session) { window.location.href = 'index.html'; return; }
  cargarFicha();
})();

document.querySelectorAll('.logout-trigger').forEach(btn => {
  btn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });
});

async function cargarFicha() {
  const params = new URLSearchParams(window.location.search);
  const nombreJugador = params.get('jugador');

  if (!nombreJugador) {
    document.getElementById('ficha-nombre').textContent = t('ui.jugadorNoEspecificado');
    return;
  }

  const { data, error } = await supabaseClient
    .from('analisis_jugador')
    .select('*')
    .eq('jugador_nombre', nombreJugador)
    .order('creado_en', { ascending: true });

  if (error || !data || data.length === 0) {
    document.getElementById('ficha-nombre').textContent = nombreJugador;
    document.getElementById('historial-list').innerHTML = `<p class="empty-message">${t('ui.sinHistorial')}</p>`;
    return;
  }

  datosCompletos = data;
  document.getElementById('ficha-nombre').textContent = nombreJugador;

  poblarFiltrosFicha(data);
  renderizarFicha(data);
}

function poblarFiltrosFicha(data) {
  const competiciones = new Set();
  const temporadas = new Set();
  data.forEach(a => { competiciones.add(a.competicion); temporadas.add(a.temporada); });

  ['filtro-competicion', 'filtro-temporada'].forEach(id => {
    const select = document.getElementById(id);
    select.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  });
  [...competiciones].sort().forEach(v => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = v;
    document.getElementById('filtro-competicion').appendChild(opt);
  });
  [...temporadas].sort().forEach(v => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = v;
    document.getElementById('filtro-temporada').appendChild(opt);
  });
}

function aplicarFiltrosFicha() {
  const competicion = document.getElementById('filtro-competicion').value;
  const temporada = document.getElementById('filtro-temporada').value;

  const filtrados = datosCompletos.filter(a => {
    if (competicion && a.competicion !== competicion) return false;
    if (temporada && a.temporada !== temporada) return false;
    return true;
  });

  renderizarFicha(filtrados);
}

document.getElementById('filtro-competicion').addEventListener('change', aplicarFiltrosFicha);
document.getElementById('filtro-temporada').addEventListener('change', aplicarFiltrosFicha);
document.getElementById('limpiar-filtros-ficha').addEventListener('click', () => {
  document.getElementById('filtro-competicion').value = '';
  document.getElementById('filtro-temporada').value = '';
  renderizarFicha(datosCompletos);
});

function renderizarFicha(data) {
  if (data.length === 0) {
    document.getElementById('ficha-equipo-actual').textContent = t('ui.sinAnalisisFiltros');
  } else {
    document.getElementById('ficha-equipo-actual').textContent = data[data.length - 1].equipo;
  }

  const totalGoles = data.reduce((sum, a) => sum + (a.goles || 0), 0);
  const totalAsistencias = data.reduce((sum, a) => sum + (a.asistencias || 0), 0);
  const notas = data.filter(a => a.nota !== null).map(a => a.nota);
  const notaMedia = notas.length ? (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1) : '—';

  document.getElementById('stat-analisis').textContent = data.length;
  document.getElementById('stat-goles').textContent = totalGoles;
  document.getElementById('stat-asistencias').textContent = totalAsistencias;
  document.getElementById('stat-nota-media').textContent = notaMedia;

  const labels = data.map((a, i) => `#${i + 1} · ${new Date(a.creado_en).toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit' })}`);

  // Gráfico de notas
  if (chartNotas) chartNotas.destroy();
  chartNotas = new Chart(document.getElementById('chart-notas'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: t('ui.nota'),
        data: data.map(a => a.nota),
        borderColor: '#111111',
        backgroundColor: 'rgba(17,17,17,0.08)',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#111111'
      }]
    },
    options: {
      responsive: true,
      scales: { y: { min: 0, max: 10, ticks: { stepSize: 1 } } },
      plugins: { legend: { display: false } }
    }
  });

  // Gráfico de goles y asistencias acumulados
  let acumGoles = 0, acumAsis = 0;
  const golesAcumulados = data.map(a => (acumGoles += (a.goles || 0)));
  const asisAcumuladas = data.map(a => (acumAsis += (a.asistencias || 0)));

  if (chartGolesAsis) chartGolesAsis.destroy();
  chartGolesAsis = new Chart(document.getElementById('chart-goles-asis'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Goles', data: golesAcumulados, borderColor: '#3B5B66', backgroundColor: 'transparent', tension: 0.2, pointRadius: 3 },
        { label: 'Asistencias', data: asisAcumuladas, borderColor: '#A65A3D', backgroundColor: 'transparent', tension: 0.2, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      plugins: { legend: { display: true, position: 'bottom' } }
    }
  });

  renderHistorialTendencia(data);

  // Mapa de calor de posiciones medias
  const conPosicion = data.filter(a => a.posicion_x !== null && a.posicion_x !== undefined);
  const grupo = document.getElementById('heatmap-points');
  grupo.innerHTML = '';
  if (conPosicion.length === 0) {
    document.getElementById('heatmap-pitch').hidden = true;
    document.getElementById('heatmap-empty').hidden = false;
  } else {
    document.getElementById('heatmap-pitch').hidden = false;
    document.getElementById('heatmap-empty').hidden = true;
    conPosicion.forEach(a => {
      const cx = (parseFloat(a.posicion_x) / 100) * 300;
      const cy = (parseFloat(a.posicion_y) / 100) * 450;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', 16);
      circle.setAttribute('fill', '#111111');
      circle.setAttribute('fill-opacity', '0.14');
      grupo.appendChild(circle);
    });
  }

  // Historial (del más reciente al más antiguo)
  const historial = document.getElementById('historial-list');
  historial.innerHTML = '';
  [...data].reverse().forEach(a => {
    const card = document.createElement('div');
    card.className = 'result-card';
    const fecha = new Date(a.creado_en).toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
    card.innerHTML = `
      <div class="result-card-header" style="cursor:default;">
        <div>
          <p class="result-title">${a.equipo} · ${t('ui.nota')} ${a.nota ?? '—'}/10</p>
          <p class="result-subtitle">${a.competicion} · ${a.temporada} · ${fecha}</p>
        </div>
      </div>
      <div class="result-card-detail">
        <div class="detail-grid">
          <div><p class="detail-label">${t('ui.goles')}</p><p>${a.goles}</p></div>
          <div><p class="detail-label">${t('ui.asistencias')}</p><p>${a.asistencias}</p></div>
        </div>
        ${a.tendencia ? `<p class="detail-label">${t('jf.tendencia')}</p><p><span class="trend-badge ${claseTendencia(a.tendencia)}">${etiquetaTendencia(a.tendencia)}</span></p>` : ''}
        ${a.importancia ? `<p class="detail-label">${t('jf.importancia')}</p><p>${etiquetaImportancia(a.importancia)}</p>` : ''}
        ${a.punto_debil ? `<p class="detail-label">${t('jf.puntoDebil')}</p><p>${a.punto_debil}</p>` : ''}
        ${a.pie_dominante ? `<p class="detail-label">${t('jf.pie')}</p><p>${etiquetaPie(a.pie_dominante)}</p>` : ''}
        ${a.potencial ? `<p class="detail-label">${t('jf.potencial')}</p><p>${etiquetaPotencial(a.potencial)}</p>` : ''}
        ${a.resistencia ? `<p class="detail-label">${t('jf.resistencia')}</p><p>${etiquetaResistencia(a.resistencia)}</p>` : ''}
        ${a.impresiones ? `<p class="detail-label">${t('ui.impresiones')}</p><p>${a.impresiones}</p>` : ''}
        ${a.acciones_clave && a.acciones_clave.length ? `<p class="detail-label">${t('jf.acciones')}</p>${htmlAcciones(a.acciones_clave)}` : ''}
        ${a.etiquetas && a.etiquetas.length ? `<p class="detail-label">${t('ui.etiquetas')}</p>${htmlTags(a.etiquetas)}` : ''}
      </div>
    `;
    historial.appendChild(card);
  });
}
