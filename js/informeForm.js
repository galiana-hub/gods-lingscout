// ---------- Editor de informes (captura o vídeo) ----------
const infParams = new URLSearchParams(window.location.search);
const infEditId = infParams.get('id');
let infTipo = infParams.get('tipo') === 'video' ? 'video' : 'captura';
let infUsuario = null;
let infOriginal = null;       // informe cargado al editar
let infArchivoNuevo = null;   // File elegido (imagen o vídeo)
let infUrlLocal = null;       // dirección temporal del vídeo elegido
let infBloques = [];          // [{ titulo, texto }]
let infPlantillas = [];
let infCambios = false;
let infGuardando = false;

const $ = (id) => document.getElementById(id);

// Dibujo sobre la captura
const anot = Anotador.init($('anot-canvas'), {
  onChange: () => { infCambios = true; },
  onNeedText: () => { mensaje($('form-message'), t('inf.necesitaTexto'), true); }
});
Anotador.barra($('anot-toolbar'), anot, { confirmarLimpiar: () => confirm(t('inf.confirmBorrarDibujos')) });

// Visor del partido con etiquetas
const visor = VideoVisor.crear($('visor'), { editable: true, onChange: () => { infCambios = true; } });

function mensaje(el, texto, error) {
  el.textContent = texto || '';
  el.className = 'form-message' + (texto ? (error ? ' error' : ' success') : '');
}

function nuevoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------- Arranque ----------
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) { window.location.href = 'index.html'; return; }
  infUsuario = data.session.user.id;

  if (infEditId) {
    const { data: inf, error } = await supabaseClient.from('informes').select('*').eq('id', infEditId).single();
    if (error || !inf) {
      mensaje($('form-message'), infFaltaTabla(error) ? t('inf.faltaSql') : `${t('ui.errorCargar')} ${error ? error.message : ''}`, true);
      return;
    }
    infOriginal = inf;
    infTipo = inf.tipo;
    prepararTipo();
    rellenar(inf);
    $('informe-h2').setAttribute('data-i18n', 'inf.titleEditar');
    $('informe-h2').textContent = t('inf.titleEditar');
    $('inf-guardar').setAttribute('data-i18n', 'ui.guardarCambios');
    $('inf-guardar').textContent = t('ui.guardarCambios');
  } else {
    infBloques = (infTipo === 'captura' ? ['queSeVe', 'conclusion'] : ['contexto', 'conclusion'])
      .map(k => ({ titulo: infTituloPreset(k), texto: '' }));
    pintarBloques();
    if (infTipo === 'video') actualizarOrigen();
  }
  cargarSugerencias();
  cargarPlantillas();
})();

document.querySelectorAll('.logout-trigger').forEach(btn => btn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}));

function prepararTipo() {
  $('bloque-captura').hidden = infTipo !== 'captura';
  $('bloque-video').hidden = infTipo !== 'video';
  const clave = infTipo === 'captura' ? 'inf.titleCaptura' : 'inf.titleVideo';
  $('informe-h2').setAttribute('data-i18n', clave);
  $('informe-h2').textContent = t(clave);
  document.title = `${t(clave)} — LingScout`;
}
prepararTipo();

async function cargarSugerencias() {
  const { data } = await supabaseClient.from('jugadores').select('nombre').order('nombre');
  const dl = $('jugadores-list');
  (data || []).forEach(j => { const o = document.createElement('option'); o.value = j.nombre; dl.appendChild(o); });
}

function rellenar(inf) {
  $('inf-titulo').value = inf.titulo || '';
  $('inf-fecha').value = inf.fecha || '';
  $('inf-equipo').value = inf.equipo || '';
  $('inf-jugador').value = inf.jugador || '';
  $('inf-competicion').value = inf.competicion || '';
  $('inf-temporada').value = inf.temporada || '';
  $('inf-etiquetas').value = (inf.etiquetas || []).join(', ');
  infBloques = Array.isArray(inf.bloques) ? inf.bloques.map(b => ({ titulo: b.titulo || '', texto: b.texto || '' })) : [];
  pintarBloques();

  if (inf.tipo === 'captura') {
    if (inf.archivo_path) {
      infUrlFirmada(inf.archivo_path).then(url => {
        if (!url) { mensaje($('form-message'), t('inf.archivoNoDisponible'), true); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { anot.setImagen(img); anot.setFormas(inf.anotaciones || []); $('anot-toolbar').hidden = false; infCambios = false; };
        img.src = url;
      });
    }
  } else {
    const sub = document.querySelector(`input[name="subtipo"][value="${inf.subtipo === 'jugada' ? 'jugada' : 'partido'}"]`);
    if (sub) sub.checked = true;
    const origen = ['subido', 'local', 'enlace'].includes(inf.origen) ? inf.origen : 'subido';
    document.querySelector(`input[name="origen"][value="${origen}"]`).checked = true;
    if (origen === 'enlace') $('inf-enlace').value = inf.enlace || '';
    if (inf.archivo_nombre) $('archivo-nombre').textContent = inf.archivo_nombre;
    visor.setMarcas(inf.marcas || []);
    actualizarOrigen();
  }
  infCambios = false;
}

// ---------- Captura ----------
function cargarImagen(archivo) {
  if (!archivo || !archivo.type.startsWith('image/')) return;
  if (anot.getFormas().length && !confirm(t('inf.confirmCambiarImagen'))) return;
  infArchivoNuevo = archivo;
  const img = new Image();
  img.onload = () => { anot.setImagen(img); anot.setFormas([]); $('anot-toolbar').hidden = false; infCambios = true; };
  img.src = URL.createObjectURL(archivo);
}
$('inf-imagen').addEventListener('change', (e) => { cargarImagen(e.target.files[0]); e.target.value = ''; });
document.addEventListener('paste', (e) => {
  if (infTipo !== 'captura' || !e.clipboardData) return;
  const item = [...e.clipboardData.items].find(i => i.type && i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  const f = item.getAsFile();
  if (f) cargarImagen(new File([f], `captura-${Date.now()}.png`, { type: f.type || 'image/png' }));
});

// ---------- Vídeo ----------
function origenActual() {
  const r = document.querySelector('input[name="origen"]:checked');
  return r ? r.value : 'subido';
}

function actualizarOrigen() {
  const o = origenActual();
  $('origen-archivo').hidden = o === 'enlace';
  $('origen-enlace').hidden = o !== 'enlace';
  $('ayuda-local').hidden = o !== 'local';
  avisoPeso();
  if (o === 'enlace') {
    const id = infIdYoutube($('inf-enlace').value);
    const url = infEnlaceValido($('inf-enlace').value);
    visor.setFuente(id ? { tipo: 'youtube', id } : (url ? { tipo: 'enlace', url } : { tipo: 'ninguno' }));
  } else if (infArchivoNuevo) {
    if (!infUrlLocal) infUrlLocal = URL.createObjectURL(infArchivoNuevo);
    visor.setFuente({ tipo: 'video', url: infUrlLocal });
  } else if (o === 'subido' && infOriginal && infOriginal.origen === 'subido' && infOriginal.archivo_path) {
    infUrlFirmada(infOriginal.archivo_path).then(url => {
      if (origenActual() !== 'subido' || infArchivoNuevo) return;
      visor.setFuente(url ? { tipo: 'video', url } : { tipo: 'ninguno' });
      if (!url) mensaje($('form-message'), t('inf.archivoNoDisponible'), true);
    });
  } else {
    visor.setFuente({ tipo: 'ninguno' });
  }
}

function avisoPeso() {
  const el = $('aviso-peso');
  if (infArchivoNuevo && origenActual() === 'subido' && infArchivoNuevo.size > 50 * 1024 * 1024) {
    mensaje(el, t('inf.avisoPeso').replace('{mb}', Math.round(infArchivoNuevo.size / 1048576)), true);
  } else {
    mensaje(el, '', false);
  }
}

document.querySelectorAll('input[name="origen"]').forEach(r => r.addEventListener('change', () => { infCambios = true; actualizarOrigen(); }));
document.querySelectorAll('input[name="subtipo"]').forEach(r => r.addEventListener('change', () => { infCambios = true; }));
$('inf-enlace').addEventListener('change', () => { infCambios = true; actualizarOrigen(); });
$('inf-video-archivo').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (infUrlLocal) URL.revokeObjectURL(infUrlLocal);
  infUrlLocal = null;
  infArchivoNuevo = f;
  infCambios = true;
  $('archivo-nombre').textContent = `${f.name} · ${Math.max(1, Math.round(f.size / 1048576))} MB`;
  actualizarOrigen();
});

// ---------- Secciones personalizables ----------
function pintarPresets() {
  const cont = $('presets');
  cont.innerHTML = '';
  INF_PRESETS.forEach(k => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip chip-preset';
    b.textContent = '+ ' + infTituloPreset(k);
    b.addEventListener('click', () => {
      const titulo = infTituloPreset(k);
      const idx = infBloques.findIndex(x => x.titulo.trim().toLowerCase() === titulo.toLowerCase());
      if (idx >= 0) { const el = document.querySelectorAll('.bloque-texto')[idx]; if (el) el.focus(); return; }
      infBloques.push({ titulo, texto: '' });
      infCambios = true;
      pintarBloques(infBloques.length - 1);
    });
    cont.appendChild(b);
  });
}
pintarPresets();

function pintarBloques(enfocar) {
  const cont = $('bloques-lista');
  cont.innerHTML = '';
  infBloques.forEach((b, i) => {
    const fila = document.createElement('div');
    fila.className = 'bloque-row';

    const titulo = document.createElement('input');
    titulo.type = 'text'; titulo.className = 'bloque-titulo'; titulo.maxLength = 80;
    titulo.placeholder = t('inf.seccionNombrePh'); titulo.setAttribute('data-i18n-placeholder', 'inf.seccionNombrePh');
    titulo.value = b.titulo;
    titulo.addEventListener('input', () => { b.titulo = titulo.value; infCambios = true; });

    const boton = (txt, clave, fn, desactivado) => {
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'bloque-btn'; x.textContent = txt;
      x.title = t(clave); x.setAttribute('aria-label', t(clave));
      x.disabled = !!desactivado;
      x.addEventListener('click', fn);
      return x;
    };
    const mover = (d) => () => { const j = i + d; [infBloques[i], infBloques[j]] = [infBloques[j], infBloques[i]]; infCambios = true; pintarBloques(); };

    const cabecera = document.createElement('div');
    cabecera.className = 'bloque-cabecera';
    cabecera.append(
      titulo,
      boton('↑', 'inf.subir', mover(-1), i === 0),
      boton('↓', 'inf.bajar', mover(1), i === infBloques.length - 1),
      boton('✕', 'inf.quitar', () => {
        if (b.texto.trim() && !confirm(t('inf.confirmQuitarSeccion'))) return;
        infBloques.splice(i, 1); infCambios = true; pintarBloques();
      })
    );

    const texto = document.createElement('textarea');
    texto.className = 'bloque-texto'; texto.rows = 3; texto.maxLength = 20000;
    texto.placeholder = t('inf.seccionTextoPh'); texto.setAttribute('data-i18n-placeholder', 'inf.seccionTextoPh');
    texto.value = b.texto;
    texto.addEventListener('input', () => { b.texto = texto.value; infCambios = true; });

    fila.append(cabecera, texto);
    cont.appendChild(fila);
    if (window.autoCrecer) window.autoCrecer(texto);
    if (enfocar === i) (b.titulo ? texto : titulo).focus();
  });
}

$('anadir-bloque').addEventListener('click', () => {
  infBloques.push({ titulo: '', texto: '' });
  infCambios = true;
  pintarBloques(infBloques.length - 1);
});

// ---------- Plantillas ----------
async function cargarPlantillas() {
  const { data, error } = await supabaseClient.from('plantillas_informe').select('*').eq('tipo', infTipo).order('nombre');
  if (error) { if (infFaltaTabla(error)) mensaje($('plantilla-msg'), t('inf.faltaSql'), true); return; }
  infPlantillas = data || [];
  const sel = $('plantilla-select');
  sel.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  infPlantillas.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.nombre; sel.appendChild(o); });
  $('plantilla-borrar').hidden = !sel.value;
}

$('plantilla-select').addEventListener('change', () => {
  const p = infPlantillas.find(x => x.id === $('plantilla-select').value);
  $('plantilla-borrar').hidden = !p;
  if (!p) return;
  const nuevos = (p.bloques || []).map(b => ({ titulo: String(b.titulo || ''), texto: '' })).filter(b => b.titulo);
  const vacio = infBloques.every(b => !b.texto.trim());
  if (vacio) {
    infBloques = nuevos;
  } else {
    const existentes = new Set(infBloques.map(b => b.titulo.trim().toLowerCase()));
    nuevos.forEach(b => { if (!existentes.has(b.titulo.trim().toLowerCase())) infBloques.push(b); });
  }
  infCambios = true;
  pintarBloques();
  mensaje($('plantilla-msg'), '', false);
});

$('plantilla-guardar').addEventListener('click', async () => {
  const nombre = $('plantilla-nombre').value.trim();
  const titulos = infBloques.map(b => b.titulo.trim()).filter(Boolean);
  if (!nombre) { mensaje($('plantilla-msg'), t('inf.plantillaFaltaNombre'), true); $('plantilla-nombre').focus(); return; }
  if (!titulos.length) { mensaje($('plantilla-msg'), t('inf.plantillaVacia'), true); return; }
  const { error } = await supabaseClient.from('plantillas_informe')
    .upsert({ usuario_id: infUsuario, tipo: infTipo, nombre, bloques: titulos.map(x => ({ titulo: x })) }, { onConflict: 'usuario_id,tipo,nombre' });
  if (error) { mensaje($('plantilla-msg'), infFaltaTabla(error) ? t('inf.faltaSql') : `${t('ui.errorGuardar')} ${error.message}`, true); return; }
  $('plantilla-nombre').value = '';
  mensaje($('plantilla-msg'), t('inf.plantillaGuardada'), false);
  await cargarPlantillas();
});

$('plantilla-borrar').addEventListener('click', async () => {
  const p = infPlantillas.find(x => x.id === $('plantilla-select').value);
  if (!p || !confirm(t('inf.confirmBorrarPlantilla').replace('{n}', p.nombre))) return;
  const { error } = await supabaseClient.from('plantillas_informe').delete().eq('id', p.id);
  if (error) { mensaje($('plantilla-msg'), `${t('ui.errorBorrar')} ${error.message}`, true); return; }
  $('plantilla-select').value = '';
  await cargarPlantillas();
});

// ---------- Guardar ----------
['inf-titulo', 'inf-fecha', 'inf-equipo', 'inf-jugador', 'inf-competicion', 'inf-temporada', 'inf-etiquetas']
  .forEach(id => $(id).addEventListener('input', () => { infCambios = true; }));

window.addEventListener('beforeunload', (e) => {
  if (infCambios && !infGuardando) { e.preventDefault(); e.returnValue = ''; }
});

function errorSubida(error) {
  const txt = `${error.message || ''} ${error.statusCode || ''}`;
  if (/exceed|too large|413|size/i.test(txt)) return t('inf.errorPeso');
  if (/bucket not found/i.test(txt)) return t('inf.faltaSql');
  return `${t('ui.errorGuardar')} ${error.message || ''}`;
}

$('informe-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (infGuardando) return;
  const msg = $('form-message');
  mensaje(msg, '', false);

  const titulo = $('inf-titulo').value.trim();
  if (!titulo) { mensaje(msg, t('inf.faltaTitulo'), true); $('inf-titulo').focus(); return; }

  const origen = infTipo === 'captura' ? 'subido' : origenActual();
  const orig = infOriginal || {};
  const pathOriginal = orig.origen === 'subido' || orig.tipo === 'captura' ? orig.archivo_path : null;
  let enlace = null;

  if (infTipo === 'captura' && !infArchivoNuevo && !pathOriginal) { mensaje(msg, t('inf.faltaCaptura'), true); return; }
  if (infTipo === 'video') {
    if (origen === 'subido' && !infArchivoNuevo && !pathOriginal) { mensaje(msg, t('inf.faltaVideo'), true); return; }
    if (origen === 'local' && !infArchivoNuevo && !orig.archivo_nombre) { mensaje(msg, t('inf.faltaVideo'), true); return; }
    if (origen === 'enlace') {
      enlace = infEnlaceValido($('inf-enlace').value);
      if (!enlace) { mensaje(msg, t('inf.faltaEnlace'), true); $('inf-enlace').focus(); return; }
    }
  }

  infGuardando = true;
  const boton = $('inf-guardar');
  const textoBoton = boton.textContent;
  boton.disabled = true;

  let pathNuevo = null;
  try {
    // 1) Subir el archivo si hace falta
    if (infArchivoNuevo && origen === 'subido') {
      boton.textContent = t('inf.subiendo');
      const ext = ((infArchivoNuevo.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5))
        || (infArchivoNuevo.type.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5);
      pathNuevo = `${infUsuario}/${nuevoId()}.${ext}`;
      const { error } = await supabaseClient.storage.from(INF_BUCKET)
        .upload(pathNuevo, infArchivoNuevo, { contentType: infArchivoNuevo.type || undefined, upsert: false, cacheControl: '3600' });
      if (error) { pathNuevo = null; throw new Error(errorSubida(error)); }
    }

    // 2) Guardar el informe
    let archivoPath = null, archivoNombre = null, archivoMime = null;
    if (origen === 'subido') {
      archivoPath = pathNuevo || pathOriginal;
      archivoNombre = infArchivoNuevo ? infArchivoNuevo.name : (orig.archivo_nombre || null);
      archivoMime = infArchivoNuevo ? (infArchivoNuevo.type || null) : (orig.archivo_mime || null);
    } else if (origen === 'local') {
      archivoNombre = infArchivoNuevo ? infArchivoNuevo.name : (orig.archivo_nombre || null);
      archivoMime = infArchivoNuevo ? (infArchivoNuevo.type || null) : (orig.archivo_mime || null);
    }

    const etiquetas = $('inf-etiquetas').value.split(',').map(x => normalizarTag(x)).filter(Boolean);
    const fila = {
      usuario_id: infUsuario,
      tipo: infTipo,
      subtipo: infTipo === 'video' ? (document.querySelector('input[name="subtipo"]:checked') || {}).value || 'partido' : null,
      titulo,
      fecha: $('inf-fecha').value || null,
      equipo: $('inf-equipo').value.trim() || null,
      jugador: $('inf-jugador').value.trim() || null,
      competicion: $('inf-competicion').value.trim() || null,
      temporada: $('inf-temporada').value.trim() || null,
      origen,
      archivo_path: archivoPath,
      archivo_nombre: archivoNombre,
      archivo_mime: archivoMime,
      enlace,
      anotaciones: infTipo === 'captura' ? anot.getFormas() : [],
      marcas: infTipo === 'video' ? visor.getMarcas() : [],
      bloques: infBloques.map(b => ({ titulo: b.titulo.trim(), texto: b.texto.trim() })).filter(b => b.titulo || b.texto),
      etiquetas: etiquetas.length ? [...new Set(etiquetas)] : null,
      actualizado_en: new Date().toISOString()
    };

    boton.textContent = t('ui.preparando');
    const { error } = infEditId
      ? await supabaseClient.from('informes').update(fila).eq('id', infEditId)
      : await supabaseClient.from('informes').insert(fila);
    if (error) throw new Error(infFaltaTabla(error) ? t('inf.faltaSql') : `${t('ui.errorGuardar')} ${error.message}`);

    // 3) Si se ha sustituido o quitado el archivo anterior, se borra del almacén
    if (pathOriginal && pathOriginal !== archivoPath) {
      await supabaseClient.storage.from(INF_BUCKET).remove([pathOriginal]);
    }

    infCambios = false;
    mensaje(msg, infEditId ? t('ui.cambiosOk') : t('ui.guardadoOk'), false);
    setTimeout(() => { window.location.href = 'informes.html'; }, 900);
  } catch (err) {
    if (pathNuevo) await supabaseClient.storage.from(INF_BUCKET).remove([pathNuevo]);
    mensaje(msg, err.message, true);
    infGuardando = false;
  } finally {
    boton.disabled = false;
    boton.textContent = textoBoton;
  }
});
