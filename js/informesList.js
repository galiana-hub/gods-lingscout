// ---------- Lista de informes (capturas y vídeos) ----------
let todosLosInformes = [];

(async () => {
  const { data: sesion } = await supabaseClient.auth.getSession();
  if (!sesion.session) { window.location.href = 'index.html'; return; }
  cargarInformes();
})();

document.querySelectorAll('.logout-trigger').forEach(btn => btn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}));

async function cargarInformes() {
  const contenedor = document.getElementById('lista-informes');
  const { data, error } = await supabaseClient.from('informes').select('*')
    .order('fecha', { ascending: false, nullsFirst: false })
    .order('creado_en', { ascending: false });
  if (error) {
    const texto = infFaltaTabla(error) ? t('inf.faltaSql') : `${t('ui.errorCargar')} ${error.message}`;
    contenedor.innerHTML = `<p class="empty-message">${escaparHtml(texto)}</p>`;
    return;
  }
  todosLosInformes = data || [];

  // Enlaces temporales de todas las capturas de una vez (para las miniaturas)
  const paths = todosLosInformes.filter(i => i.tipo === 'captura' && i.archivo_path).map(i => i.archivo_path);
  if (paths.length) {
    const { data: urls } = await supabaseClient.storage.from(INF_BUCKET).createSignedUrls(paths, 3600);
    (urls || []).forEach(u => { if (u.signedUrl) _infUrls[u.path] = { url: u.signedUrl, hasta: Date.now() + 50 * 60 * 1000 }; });
  }

  const equipos = new Set(todosLosInformes.map(i => i.equipo).filter(Boolean));
  const sel = document.getElementById('filtro-equipo');
  sel.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  [...equipos].sort().forEach(e => { const o = document.createElement('option'); o.value = e; o.textContent = e; sel.appendChild(o); });

  aplicarFiltros();
}

function aplicarFiltros() {
  const tipo = document.getElementById('filtro-tipo').value;
  const equipo = document.getElementById('filtro-equipo').value;
  const q = document.getElementById('filtro-busqueda').value.trim().toLowerCase();
  renderizarLista(todosLosInformes.filter(i => {
    if (tipo && i.tipo !== tipo) return false;
    if (equipo && i.equipo !== equipo) return false;
    if (q) {
      const texto = [
        i.titulo, i.equipo, i.jugador, i.competicion, i.temporada,
        ...(i.bloques || []).map(b => `${b.titulo} ${b.texto}`),
        ...(i.marcas || []).map(m => `${m.etq} ${m.texto}`),
        ...(i.etiquetas || [])
      ].join(' ').toLowerCase();
      if (!texto.includes(q)) return false;
    }
    return true;
  }));
}

document.getElementById('filtro-busqueda').addEventListener('input', aplicarFiltros);
document.getElementById('filtro-tipo').addEventListener('change', aplicarFiltros);
document.getElementById('filtro-equipo').addEventListener('change', aplicarFiltros);
document.getElementById('limpiar-filtros').addEventListener('click', () => {
  document.getElementById('filtro-busqueda').value = '';
  document.getElementById('filtro-tipo').value = '';
  document.getElementById('filtro-equipo').value = '';
  aplicarFiltros();
});

function fechaCorta(f) {
  if (!f) return '';
  const d = new Date(f + 'T12:00:00');
  return isNaN(d) ? f : d.toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function subtituloInforme(i) {
  return [infEtiquetaTipo(i), fechaCorta(i.fecha), i.equipo, i.jugador].filter(Boolean).join(' · ');
}

function renderizarLista(lista) {
  const cont = document.getElementById('lista-informes');
  cont.innerHTML = '';
  if (!lista.length) {
    cont.innerHTML = `<p class="empty-message">${escaparHtml(todosLosInformes.length ? t('inf.sinResultados') : t('inf.sinInformes'))}</p>`;
    return;
  }

  lista.forEach(inf => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const header = document.createElement('div');
    header.className = 'result-card-header inf-header';
    const miniatura = inf.tipo === 'captura' && inf.archivo_path && _infUrls[inf.archivo_path]
      ? `<img src="${escaparHtml(_infUrls[inf.archivo_path].url)}" alt="" loading="lazy">`
      : `<span class="inf-thumb-icono">${inf.tipo === 'captura' ? '🖼' : '▶'}</span>`;
    header.innerHTML = `
      <span class="inf-thumb">${miniatura}</span>
      <div class="inf-head-text">
        <p class="result-title">${escaparHtml(inf.titulo)}</p>
        <p class="result-subtitle">${escaparHtml(subtituloInforme(inf))}</p>
      </div>
      <span class="expand-arrow">▾</span>`;

    const detail = document.createElement('div');
    detail.className = 'result-card-detail';
    detail.hidden = true;
    detail.innerHTML = construirDetalleInforme(inf);
    let hidratado = false;

    header.addEventListener('click', () => {
      detail.hidden = !detail.hidden;
      header.querySelector('.expand-arrow').textContent = detail.hidden ? '▾' : '▴';
      if (!detail.hidden && !hidratado) { hidratado = true; hidratarMedia(detail, inf); }
      if (detail.hidden) detail.querySelectorAll('video').forEach(v => v.pause());
    });

    card.append(header, detail);
    cont.appendChild(card);

    detail.querySelector('.detail-actions').addEventListener('click', (ev) => ev.stopPropagation());
    detail.querySelector('.btn-export').addEventListener('click', () => exportarInforme(inf));
    detail.querySelector('.btn-delete').addEventListener('click', async () => {
      if (!confirm(t('inf.confirmBorrar'))) return;
      const { error } = await supabaseClient.from('informes').delete().eq('id', inf.id);
      if (error) { alert(`${t('ui.errorBorrar')} ${error.message}`); return; }
      if (inf.archivo_path) await supabaseClient.storage.from(INF_BUCKET).remove([inf.archivo_path]);
      todosLosInformes = todosLosInformes.filter(x => x.id !== inf.id);
      aplicarFiltros();
    });
  });
}

// ---------- Ficha del informe ----------
function construirDetalleInforme(inf, paraExportar) {
  const tile = (etq, val) => `<div class="detail-tile"><p class="detail-label">${etq}</p><p class="detail-value">${escaparHtml(val)}</p></div>`;
  const seccion = (titulo, contenido) => contenido ? `<section class="detail-section"><h4 class="detail-section-title">${titulo}</h4>${contenido}</section>` : '';

  let html = `
    <div class="detail-actions">
      <a href="informe.html?id=${encodeURIComponent(inf.id)}" class="btn-secondary">${t('ui.editar')}</a>
      <button type="button" class="btn-secondary btn-export">${t('ui.exportar')}</button>
      <button type="button" class="btn-secondary btn-delete">${t('ui.borrar')}</button>
    </div>`;

  if (!paraExportar && inf.tipo === 'video') html += '<div class="inf-media inf-media-video" data-media></div>';
  const tiles = [];
  if (inf.fecha) tiles.push(tile(t('inf.fecha'), fechaCorta(inf.fecha)));
  if (inf.equipo) tiles.push(tile(t('jf.equipo'), inf.equipo));
  if (inf.jugador) tiles.push(tile(t('jf.jugador'), inf.jugador));
  if (inf.competicion) tiles.push(tile(t('pf.competicion'), inf.competicion));
  if (inf.temporada) tiles.push(tile(t('pf.temporada'), inf.temporada));
  html += seccion(t('pf.sectionGeneral'), tiles.length ? `<div class="detail-tiles">${tiles.join('')}</div>` : '');

  if (paraExportar) html += '<!--inf-media-->';
  else if (inf.tipo === 'captura') html += seccion(t('inf.sectionCaptura'), '<div class="inf-media" data-media></div>');

  if (paraExportar && inf.tipo === 'video' && (inf.marcas || []).length) {
    const yt = inf.origen === 'enlace' ? infIdYoutube(inf.enlace) : null;
    const items = inf.marcas.map(m0 => {
      const m = VideoVisor.normalizarMarca(m0);
      const tiempo = infFormatoTiempo(m.t);
      const boton = yt ? `<a class="marca-chip" href="${escaparHtml(infYoutubeEn(yt, m.t))}">${tiempo}</a>` : `<span class="marca-chip">${tiempo}</span>`;
      const foto = paraExportar.fotos && paraExportar.fotos[m.id] ? `<img class="detail-drawing inf-export-img" src="${paraExportar.fotos[m.id]}" alt="">` : '';
      return `<li class="marca-vista" style="--mc:${escaparHtml(m.c)}">${boton}
        <div><p class="marca-etq-vista">${VideoVisor.iconoMarca(m)} ${escaparHtml(VideoVisor.etiquetaMarca(m))}</p>${m.texto ? `<p class="detail-value">${escaparHtml(m.texto)}</p>` : ''}${foto}</div></li>`;
    }).join('');
    html += seccion(t('inf.etiquetas'), `<ol class="marcas-vista">${items}</ol>`);
  }

  const bloques = (inf.bloques || []).filter(b => (b.texto || '').trim()).map(b =>
    `<div class="detail-item"><p class="detail-label">${escaparHtml(b.titulo || '—')}</p><div class="detail-value">${escaparHtml(b.texto || '—')}</div></div>`).join('');
  html += seccion(t('inf.sectionBloques'), bloques);

  if (inf.etiquetas && inf.etiquetas.length) html += seccion(t('ui.etiquetas'), htmlTags(inf.etiquetas));
  return html;
}

async function hidratarMedia(detail, inf) {
  const caja = detail.querySelector('[data-media]');
  if (!caja) return;
  const aviso = (txt) => { caja.innerHTML = `<p class="empty-message">${escaparHtml(txt)}</p>`; };

  if (inf.tipo === 'captura') {
    const url = await infUrlFirmada(inf.archivo_path);
    if (!url) { aviso(t('inf.archivoNoDisponible')); return; }
    caja.innerHTML = '<div class="inf-captura-vista"><img alt=""><canvas></canvas></div>';
    const img = caja.querySelector('img'), lienzo = caja.querySelector('canvas');
    img.onload = () => {
      const esc = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      lienzo.width = Math.round(img.naturalWidth * esc);
      lienzo.height = Math.round(img.naturalHeight * esc);
      Anotador.dibujarFormas(lienzo.getContext('2d'), inf.anotaciones || [], lienzo.width, lienzo.height);
    };
    img.onerror = () => aviso(t('inf.archivoNoDisponible'));
    img.src = url;
    return;
  }

  const visor = VideoVisor.crear(caja, { editable: false, marcas: inf.marcas || [] });
  if (inf.origen === 'subido') {
    const url = await infUrlFirmada(inf.archivo_path);
    visor.setFuente(url ? { tipo: 'video', url } : { tipo: 'ninguno' });
    if (!url) caja.insertAdjacentHTML('afterbegin', `<p class="empty-message">${escaparHtml(t('inf.archivoNoDisponible'))}</p>`);
  } else if (inf.origen === 'enlace') {
    const id = infIdYoutube(inf.enlace), enlace = infEnlaceValido(inf.enlace);
    visor.setFuente(id ? { tipo: 'youtube', id } : (enlace ? { tipo: 'enlace', url: enlace } : { tipo: 'ninguno' }));
  } else {
    visor.setFuente({ tipo: 'local', nombre: inf.archivo_nombre || '' });
  }
}

// ---------- Exportar ----------
async function exportarInforme(inf) {
  let fotos = {};
  if (inf.tipo === 'video' && inf.origen === 'subido' && inf.archivo_path) {
    const urlVideo = await infUrlFirmada(inf.archivo_path);
    fotos = await VideoVisor.fotogramas(urlVideo, inf.marcas || []);
  }
  let html = construirDetalleInforme(inf, { fotos });
  let media = '';
  if (inf.tipo === 'captura') {
    const url = await infUrlFirmada(inf.archivo_path);
    const imagen = url ? await Anotador.componer(url, inf.anotaciones || [], 'image/jpeg') : null;
    if (imagen) media = `<img class="detail-drawing inf-export-img" src="${imagen}" alt="">`;
    else if (url) media = `<img class="detail-drawing inf-export-img" src="${escaparHtml(url)}" alt="">`;
  } else if (inf.origen === 'enlace' && infEnlaceValido(inf.enlace)) {
    const e = infEnlaceValido(inf.enlace);
    media = `<p class="detail-value"><a href="${escaparHtml(e)}">${escaparHtml(e)}</a></p>`;
  } else if (inf.archivo_nombre) {
    media = `<p class="detail-value">${escaparHtml(inf.archivo_nombre)}</p>`;
  }
  const titulo = t(inf.tipo === 'captura' ? 'inf.sectionCaptura' : 'inf.sectionVideo');
  html = html.replace('<!--inf-media-->', media ? `<section class="detail-section"><h4 class="detail-section-title">${titulo}</h4>${media}</section>` : '');
  exportarAnalisis(inf.titulo, subtituloInforme(inf), html);
}
