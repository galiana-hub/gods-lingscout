// Proteger esta página: si no hay sesión, volver al login
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('user-email').textContent = data.session.user.email;
})();

// Cerrar sesión
document.querySelectorAll('.logout-trigger').forEach(btn => {
  btn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });
});

// Exportar datos
document.getElementById('export-data-btn').addEventListener('click', exportarDatos);

async function exportarDatos() {
  const btn = document.getElementById('export-data-btn');
  const textoOriginal = btn.textContent;
  btn.textContent = t('ui.preparando');
  btn.disabled = true;

  try {
    const [partidos, jugadoresAnalisis, jugadores, patrones] = await Promise.all([
      supabaseClient.from('analisis_partido').select('*, alineacion_partido(*)'),
      supabaseClient.from('analisis_jugador').select('*'),
      supabaseClient.from('jugadores').select('*'),
      supabaseClient.from('patrones_tacticos').select('*')
    ]);

    // Si alguna consulta falla se avisa, en vez de exportar un archivo vacío sin decir nada
    const fallo = [partidos, jugadoresAnalisis, jugadores, patrones].find(r => r.error);
    if (fallo) throw new Error(fallo.error.message);

    const exportacion = {
      exportado_en: new Date().toISOString(),
      analisis_partido: partidos.data || [],
      analisis_jugador: jugadoresAnalisis.data || [],
      jugadores: jugadores.data || [],
      patrones_tacticos: patrones.data || []
    };

    const blob = new Blob([JSON.stringify(exportacion, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lingscout-datos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(t('ui.errorExportar') + ' ' + err.message);
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
}
