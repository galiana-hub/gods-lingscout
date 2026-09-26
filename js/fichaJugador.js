(async () => {
  const { data: sesion } = await supabaseClient.auth.getSession();
  if (!sesion.session) { window.location.href = 'index.html'; return; }
  cargarFicha();
})();

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
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

  document.getElementById('ficha-nombre').textContent = nombreJugador;
  document.getElementById('ficha-equipo-actual').textContent = data[data.length - 1].equipo;

  // Estadísticas totales
  const totalGoles = data.reduce((sum, a) => sum + (a.goles || 0), 0);
  const totalAsistencias = data.reduce((sum, a) => sum + (a.asistencias || 0), 0);
  const notas = data.filter(a => a.nota !== null).map(a => a.nota);
  const notaMedia = notas.length ? (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1) : '—';

  document.getElementById('stat-analisis').textContent = data.length;
  document.getElementById('stat-goles').textContent = totalGoles;
  document.getElementById('stat-asistencias').textContent = totalAsistencias;
  document.getElementById('stat-nota-media').textContent = notaMedia;

  // Gráfico de evolución de notas
  const labels = data.map((a, i) => `#${i + 1} · ${new Date(a.creado_en).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`);
  const valoresNotas = data.map(a => a.nota);

  new Chart(document.getElementById('chart-notas'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Nota',
        data: valoresNotas,
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
      scales: {
        y: { min: 0, max: 10, ticks: { stepSize: 1 } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // Historial (orden del más reciente al más antiguo)
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
