let datosCompletos = [];
let chartNotas = null;
let chartGolesAsis = null;

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
    document.getElementById('ficha-nombre').textContent = 'Jugador no especificado';
    return;
  }

  const { data, error } = await supabaseClient
    .from('analisis_jugador')
    .select('*')
    .eq('jugador_nombre', nombreJugador)
    .order('creado_en', { ascending: true });

  if (error || !data || data.length === 0) {
    document.getElementById('ficha-nombre').textContent = nombreJugador;
    document.getElementById('historial-list').innerHTML = '<p class="empty-message">Todavía no hay análisis guardados de este jugador.</p>';
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
    document.getElementById('ficha-equipo-actual').textContent = 'Sin análisis con estos filtros';
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

  const labels = data.map((a, i) => `#${i + 1} · ${new Date(a.creado_en).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`);

  // Gráfico de notas
  if (chartNotas) chartNotas.destroy();
  chartNotas = new Chart(document.getElementById('chart-notas'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Nota',
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
    const fecha = new Date(a.creado_en).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    card.innerHTML = `
      <div class="result-card-header" style="cursor:default;">
        <div>
          <p class="result-title">${a.equipo} · Nota ${a.nota ?? '—'}/10</p>
          <p class="result-subtitle">${a.competicion} · ${a.temporada} · ${fecha}</p>
        </div>
      </div>
      <div class="result-card-detail">
        <div class="detail-grid">
          <div><p class="detail-label">Goles</p><p>${a.goles}</p></div>
          <div><p class="detail-label">Asistencias</p><p>${a.asistencias}</p></div>
        </div>
        ${a.impresiones ? `<p class="detail-label">Impresiones</p><p>${a.impresiones}</p>` : ''}
      </div>
    `;
    historial.appendChild(card);
  });
}
