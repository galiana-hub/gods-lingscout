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

// ---------- Importar copia de seguridad ----------
// Solo añade lo que falta: lo que ya existe en tu cuenta no se toca ni se borra,
// así que importar dos veces el mismo archivo no duplica nada.
const importBtn = document.getElementById('import-data-btn');
const importFile = document.getElementById('import-data-file');
const importMsg = document.getElementById('import-data-msg');

importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const archivo = importFile.files[0];
  importFile.value = '';
  if (archivo) await importarCopia(archivo);
});

function mensajeImport(texto, error) {
  importMsg.textContent = texto;
  importMsg.className = 'form-message ' + (error ? 'error' : 'success');
}

function trocear(lista, n) {
  const partes = [];
  for (let i = 0; i < lista.length; i += n) partes.push(lista.slice(i, i + n));
  return partes;
}

// Inserta solo las filas que no existen y devuelve las que realmente se han añadido
async function insertarFaltantes(tabla, filas, onConflict, tamano) {
  const anadidas = [];
  for (const grupo of trocear(filas, tamano)) {
    const { data, error } = await supabaseClient
      .from(tabla)
      .upsert(grupo, { onConflict, ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`${tabla}: ${error.message}`);
    (data || []).forEach(r => anadidas.push(r.id));
  }
  return anadidas;
}

async function importarCopia(archivo) {
  importBtn.disabled = true;
  mensajeImport('', false);
  try {
    if (archivo.size > 60 * 1024 * 1024) throw new Error(t('bk.archivoInvalido'));

    let copia;
    try { copia = JSON.parse(await archivo.text()); }
    catch { throw new Error(t('bk.archivoInvalido')); }

    const claves = ['analisis_partido', 'analisis_jugador', 'jugadores', 'patrones_tacticos'];
    const valido = copia && typeof copia === 'object' && !Array.isArray(copia)
      && claves.some(k => Array.isArray(copia[k]))
      && claves.every(k => copia[k] === undefined || Array.isArray(copia[k]))
      && claves.every(k => (copia[k] || []).every(f => f && typeof f === 'object' && !Array.isArray(f)));
    if (!valido) throw new Error(t('bk.archivoInvalido'));

    const partidos = copia.analisis_partido || [];
    const analisisJ = copia.analisis_jugador || [];
    const jugadores = copia.jugadores || [];
    const patrones = copia.patrones_tacticos || [];

    const resumen = t('bk.confirmar')
      .replace('{a}', partidos.length).replace('{b}', analisisJ.length)
      .replace('{c}', jugadores.length).replace('{d}', patrones.length);
    if (!window.confirm(resumen)) return;

    importBtn.textContent = t('bk.importando');
    const { data: sesion } = await supabaseClient.auth.getSession();
    const uid = sesion.session.user.id;

    // 1) Jugadores y patrones (se identifican por nombre)
    const limpiarPorNombre = f => { const { id, ...resto } = f; return { ...resto, usuario_id: uid }; };
    const nJug = (await insertarFaltantes('jugadores', jugadores.map(limpiarPorNombre), 'usuario_id,nombre', 100)).length;

    // 2) Partidos y, solo para los que se han añadido, su alineación
    const alineaciones = partidos.flatMap(p => (p.alineacion_partido || []).map(l => ({ ...l, usuario_id: uid })));
    const filasPartido = partidos.map(p => { const { alineacion_partido, ...resto } = p; return { ...resto, usuario_id: uid }; });
    const idsPartidoNuevos = new Set(await insertarFaltantes('analisis_partido', filasPartido, 'id', 10));
    const alinNuevas = alineaciones.filter(l => idsPartidoNuevos.has(l.analisis_partido_id));
    await insertarFaltantes('alineacion_partido', alinNuevas, 'id', 100);

    // 3) Análisis de jugador
    const nAnalisisJ = (await insertarFaltantes('analisis_jugador', analisisJ.map(a => ({ ...a, usuario_id: uid })), 'id', 10)).length;

    // 4) Patrones tácticos
    const nPatrones = (await insertarFaltantes('patrones_tacticos', patrones.map(limpiarPorNombre), 'usuario_id,nombre', 20)).length;

    mensajeImport(
      t('bk.ok').replace('{a}', idsPartidoNuevos.size).replace('{b}', nAnalisisJ).replace('{c}', nJug).replace('{d}', nPatrones),
      false
    );
  } catch (err) {
    mensajeImport(`${t('bk.error')} ${err.message}`, true);
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = t('dash.importBtn');
  }
};
