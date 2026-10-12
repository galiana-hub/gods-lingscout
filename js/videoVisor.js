// Visor de partido: etiquetas por minuto a la izquierda y vídeo a la derecha con dibujos encima.
// Al pulsar una etiqueta, el vídeo salta a su minuto y se ven los dibujos de ese momento.
(function (window) {
  const TIPOS = [
    ['gol', '⚽'], ['ocasion', '❗'], ['tiro', '🎯'], ['parada', '🧤'], ['falta', '⚠️'], ['corner', '🚩'],
    ['tarjeta', '🟨'], ['cambio', '🔁'], ['perdida', '❌'], ['recuperacion', '✅'], ['presion', '🔥'],
    ['contraataque', '⚡'], ['abp', '📐'], ['jugada', '▶️'], ['otro', '•']
  ];
  const ICONO = Object.fromEntries(TIPOS);
  const COLORES = ['#E53935', '#FDD835', '#1E88E5', '#43A047', '#8E24AA', '#111111'];
  let n = 0;
  const nid = () => 'm' + Date.now().toString(36) + (n++).toString(36);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function normalizarMarca(m) {
    return {
      id: m.id || nid(),
      t: Math.max(0, Math.floor(Number(m.t) || 0)),
      tipo: ICONO[m.tipo] ? m.tipo : 'otro',
      etq: String(m.etq || ''),
      texto: String(m.texto || ''),
      c: m.c || COLORES[0],
      dur: Math.min(60, Math.max(1, Number(m.dur) || 4)),
      formas: Array.isArray(m.formas) ? m.formas : []
    };
  }
  function etiquetaMarca(m) { return (m.etq && m.etq.trim()) || t('inf.tag_' + (ICONO[m.tipo] ? m.tipo : 'otro')); }
  function iconoMarca(m) { return ICONO[m.tipo] || ICONO.otro; }

  // ---------- YouTube (API oficial, para saber el minuto y poder saltar) ----------
  let promesaYT = null;
  function cargarYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (promesaYT) return promesaYT;
    promesaYT = new Promise((res, rej) => {
      const previo = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (previo) previo(); res(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { promesaYT = null; rej(new Error('yt')); };
      document.head.appendChild(s);
      setTimeout(() => rej(new Error('yt-timeout')), 12000);
    });
    return promesaYT;
  }

  function crear(cont, opciones) {
    const op = opciones || {};
    const editable = !!op.editable;
    let marcas = (op.marcas || []).map(normalizarMarca);
    let activa = null, dibujando = false, mostrada = null;
    let player = null, intervalo = null, fuente = { tipo: 'ninguno' }, ytPlayer = null;

    cont.innerHTML = `
      <div class="vv">
        <aside class="vv-tags">
          <p class="vv-tags-title" data-i18n="inf.etiquetas">${esc(t('inf.etiquetas'))}</p>
          <div class="vv-list"></div>
        </aside>
        <div class="vv-main">
          <div class="vv-stage">
            <div class="vv-media"></div>
            <canvas class="vv-overlay"></canvas>
          </div>
          <p class="form-message vv-msg"></p>
        </div>
        ${editable ? `
        <div class="vv-bajo">
          <div class="vv-actions">
            <button type="button" class="tool-btn vv-add" data-i18n="inf.etiquetarMinuto">${esc(t('inf.etiquetarMinuto'))}</button>
            <button type="button" class="tool-btn vv-draw" data-i18n="inf.dibujarVideo">${esc(t('inf.dibujarVideo'))}</button>
          </div>
          <div class="anot-toolbar vv-toolbar" hidden></div>
          <div class="vv-editor" hidden></div>
        </div>` : ''}
      </div>`;

    const $ = (s) => cont.querySelector(s);
    const lista = $('.vv-list'), media = $('.vv-media'), stage = $('.vv-stage'), overlay = $('.vv-overlay'), msg = $('.vv-msg');
    const anot = Anotador.init(overlay, { libre: true, onChange: () => {
      const m = marcaActiva();
      if (dibujando && m) { m.formas = anot.getFormas(); pintarLista(); cambio(); }
    } });
    anot.setActivo(false);
    if (editable) Anotador.barra($('.vv-toolbar'), anot, { confirmarLimpiar: () => confirm(t('inf.confirmBorrarDibujos')) });

    function cambio() { if (op.onChange) op.onChange(); }
    function marcaActiva() { return marcas.find(m => m.id === activa) || null; }
    function aviso(texto, error) { msg.textContent = texto || ''; msg.className = 'form-message vv-msg' + (texto ? (error ? ' error' : '') : ''); }

    // La capa de dibujo tiene siempre el tamaño exacto del vídeo en pantalla
    function ajustarCapa() {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      anot.setTamano(r.width * dpr, r.height * dpr);
    }
    if ('ResizeObserver' in window) new ResizeObserver(ajustarCapa).observe(stage);

    // ---------- Lista de etiquetas ----------
    function pintarLista() {
      const ahora = player ? player.ahora() : -1;
      const ordenadas = marcas.slice().sort((a, b) => a.t - b.t);
      const actual = ordenadas.filter(m => m.t <= ahora + 0.3).pop();
      lista.innerHTML = '';
      if (!ordenadas.length) {
        lista.innerHTML = `<p class="vv-vacio">${esc(t(editable ? 'inf.sinEtiquetas' : 'inf.sinMarcasVista'))}</p>`;
        return;
      }
      ordenadas.forEach(m => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'vv-tag' + (m.id === activa ? ' activa' : '') + (actual && actual.id === m.id ? ' actual' : '');
        b.style.setProperty('--mc', m.c);
        b.innerHTML = `<span class="vv-t">${infFormatoTiempo(m.t)}</span><span class="vv-i">${iconoMarca(m)}${m.formas.length ? ' ✏️' : ''}</span><span class="vv-l">${esc(etiquetaMarca(m))}</span>`;
        b.title = etiquetaMarca(m) + (m.texto ? ' — ' + m.texto : '');
        b.addEventListener('click', () => irAMarca(m));
        lista.appendChild(b);
      });
    }

    // ---------- Dibujos visibles según el minuto ----------
    function mostrar(m) {
      const clave = m ? m.id + ':' + JSON.stringify(m.formas).length : '';
      if (clave === mostrada) return;
      mostrada = clave;
      anot.setFormas(m ? m.formas : []);
    }
    function actualizar() {
      if (!player) return;
      if (!dibujando) {
        const ahora = player.ahora();
        const act = marcaActiva();
        let m = null;
        if (act && act.formas.length && Math.abs(ahora - act.t) < 0.8) m = act;
        else m = marcas.filter(x => x.formas.length && ahora >= x.t - 0.25 && ahora < x.t + x.dur).sort((a, b) => b.t - a.t)[0] || null;
        mostrar(m);
      }
      const ahora = Math.floor(player.ahora());
      if (ahora !== actualizar.ultimo) { actualizar.ultimo = ahora; pintarLista(); }
    }

    function irAMarca(m) {
      activa = m.id;
      if (player) {
        player.ir(m.t);
        player.pausar();
      } else if (fuente.tipo === 'youtube-sin-api') {
        window.open(infYoutubeEn(fuente.id, m.t), '_blank', 'noopener');
      }
      if (dibujando) { anot.setFormas(m.formas); mostrada = null; }
      else { mostrada = null; mostrar(m.formas.length ? m : null); }
      pintarLista();
      if (editable) abrirEditor(m);
      const r = stage.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight - 80) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---------- Fuente del vídeo ----------
    function limpiarFuente() {
      if (intervalo) { clearInterval(intervalo); intervalo = null; }
      if (ytPlayer && ytPlayer.destroy) { try { ytPlayer.destroy(); } catch (e) { /* ya destruido */ } }
      ytPlayer = null; player = null;
      media.innerHTML = ''; media.className = 'vv-media';
      stage.classList.remove('vv-sin-video');
      aviso('');
    }

    function setFuente(f) {
      if (dibujando) salirDibujo();
      limpiarFuente();
      fuente = f || { tipo: 'ninguno' };
      if (fuente.tipo === 'video') {
        const v = document.createElement('video');
        v.controls = true; v.playsInline = true; v.preload = 'metadata';
        v.src = fuente.url;
        media.appendChild(v);
        player = {
          ahora: () => v.currentTime || 0,
          ir: (s) => { try { v.currentTime = s; } catch (e) { /* aún sin cargar */ } },
          pausar: () => v.pause(),
          reproducir: () => v.play().catch(() => {}),
          listo: () => v.readyState >= 1
        };
        ['timeupdate', 'seeked', 'pause', 'play'].forEach(ev => v.addEventListener(ev, actualizar));
        v.addEventListener('loadedmetadata', () => { ajustarCapa(); actualizar(); });
        v.addEventListener('error', () => aviso(t('inf.archivoNoDisponible'), true));
      } else if (fuente.tipo === 'youtube') {
        media.classList.add('vv-yt');
        const hueco = document.createElement('div');
        media.appendChild(hueco);
        cargarYT().then(() => {
          if (fuente.id === undefined || !hueco.isConnected) return;
          ytPlayer = new YT.Player(hueco, {
            videoId: fuente.id, width: '100%', height: '100%',
            playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
            events: { onReady: () => { ajustarCapa(); actualizar(); } }
          });
          player = {
            ahora: () => (ytPlayer && ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0) || 0,
            ir: (s) => { if (ytPlayer && ytPlayer.seekTo) ytPlayer.seekTo(s, true); },
            pausar: () => { if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); },
            reproducir: () => { if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo(); },
            listo: () => !!(ytPlayer && ytPlayer.getCurrentTime)
          };
          intervalo = setInterval(actualizar, 250);
        }).catch(() => {
          // Sin la API de YouTube: se ve el vídeo y las etiquetas lo abren en su minuto
          media.innerHTML = `<iframe src="${esc(infYoutubeEmbed(fuente.id, 0, false))}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="YouTube"></iframe>`;
          fuente = { tipo: 'youtube-sin-api', id: fuente.id };
        });
      } else if (fuente.tipo === 'enlace') {
        stage.classList.add('vv-sin-video');
        media.innerHTML = `<a class="btn-secondary" href="${esc(fuente.url)}" target="_blank" rel="noopener noreferrer">${esc(t('inf.abrirEnlace'))} ↗</a>`;
        aviso(t('inf.sinPlayer'), false);
      } else if (fuente.tipo === 'local') {
        stage.classList.add('vv-sin-video');
        media.innerHTML = `<p class="archivo-nombre">${esc(fuente.nombre || '')}</p>
          <label class="btn-secondary file-btn"><span>${esc(t('inf.abrirLocal'))}</span><input type="file" accept="video/*" hidden></label>
          <p class="tags-sug-label">${esc(t('inf.ayudaLocal'))}</p>`;
        media.querySelector('input').addEventListener('change', (e) => {
          const archivo = e.target.files[0];
          if (archivo) setFuente({ tipo: 'video', url: URL.createObjectURL(archivo) });
        });
      } else {
        stage.classList.add('vv-sin-video');
      }
      mostrada = null;
      pintarLista();
      ajustarCapa();
    }

    // ---------- Edición ----------
    function nuevaMarca(seg, tipo) {
      const m = normalizarMarca({ t: seg, tipo: tipo || 'jugada', c: COLORES[marcas.length % COLORES.length] });
      marcas.push(m);
      activa = m.id;
      cambio();
      return m;
    }

    function necesitaVideo() {
      if (player) return false;
      aviso(t('inf.faltaVideo'), true);
      return true;
    }

    function entrarDibujo() {
      if (necesitaVideo()) return;
      player.pausar();
      const ahora = Math.floor(player.ahora());
      let m = marcaActiva();
      if (!m || Math.abs(m.t - ahora) > 1) m = nuevaMarca(ahora, 'jugada');
      activa = m.id;
      dibujando = true;
      anot.setFormas(m.formas);
      anot.setActivo(true);
      overlay.classList.add('vv-dibujando');
      $('.vv-toolbar').hidden = false;
      const b = $('.vv-draw'); b.textContent = t('inf.terminarDibujo'); b.setAttribute('data-i18n', 'inf.terminarDibujo'); b.classList.add('active');
      pintarLista();
      abrirEditor(m);
    }

    function salirDibujo() {
      const m = marcaActiva();
      if (m) m.formas = anot.getFormas();
      dibujando = false;
      anot.deseleccionar();
      anot.setActivo(false);
      overlay.classList.remove('vv-dibujando');
      $('.vv-toolbar').hidden = true;
      const b = $('.vv-draw'); b.textContent = t('inf.dibujarVideo'); b.setAttribute('data-i18n', 'inf.dibujarVideo'); b.classList.remove('active');
      mostrada = null;
      actualizar();
      pintarLista();
    }

    function abrirEditor(m) {
      const ed = $('.vv-editor');
      if (!ed) return;
      ed.hidden = false;
      ed.innerHTML = `
        <div class="vv-editor-cab">
          <span class="vv-editor-t">${iconoMarca(m)} ${infFormatoTiempo(m.t)}</span>
          <button type="button" class="btn-secondary btn-delete vv-quitar" data-i18n="inf.quitarEtq">${esc(t('inf.quitarEtq'))}</button>
        </div>
        <div class="grid-2">
          <div>
            <label data-i18n="inf.tipoAccion">${esc(t('inf.tipoAccion'))}</label>
            <select class="vv-tipo">${TIPOS.map(([k, ic]) => `<option value="${k}"${k === m.tipo ? ' selected' : ''}>${ic} ${esc(t('inf.tag_' + k))}</option>`).join('')}</select>
          </div>
          <div>
            <label data-i18n="inf.minuto">${esc(t('inf.minuto'))}</label>
            <input type="text" class="vv-min" inputmode="numeric" value="${infFormatoTiempo(m.t)}">
          </div>
        </div>
        <label data-i18n="inf.nombreEtq">${esc(t('inf.nombreEtq'))}</label>
        <input type="text" class="vv-etq" maxlength="40" value="${esc(m.etq)}">
        <div class="grid-2">
          <div>
            <label data-i18n="inf.duracion">${esc(t('inf.duracion'))}</label>
            <input type="number" class="vv-dur" min="1" max="60" step="1" value="${m.dur}">
          </div>
          <div>
            <label data-i18n="inf.color">${esc(t('inf.color'))}</label>
            <div class="vv-colores">${COLORES.map(c => `<button type="button" class="anot-color${c === m.c ? ' active' : ''}" data-color="${c}" style="--sw:${c}" aria-label="${c}"></button>`).join('')}</div>
          </div>
        </div>
        <label data-i18n="inf.notaEtq">${esc(t('inf.notaEtq'))}</label>
        <textarea class="vv-nota" rows="2" maxlength="3000" placeholder="${esc(t('inf.marcaTextoPh'))}">${esc(m.texto)}</textarea>`;
      const q = (s) => ed.querySelector(s);
      const refrescar = () => { pintarLista(); cambio(); q('.vv-editor-t').textContent = `${iconoMarca(m)} ${infFormatoTiempo(m.t)}`; };
      q('.vv-tipo').addEventListener('change', (e) => { m.tipo = e.target.value; refrescar(); });
      q('.vv-etq').addEventListener('input', (e) => { m.etq = e.target.value; refrescar(); });
      q('.vv-nota').addEventListener('input', (e) => { m.texto = e.target.value; cambio(); });
      q('.vv-dur').addEventListener('change', (e) => { m.dur = Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 4)); e.target.value = m.dur; cambio(); });
      q('.vv-min').addEventListener('change', (e) => {
        const s = infLeerTiempo(e.target.value);
        if (s === null) { e.target.value = infFormatoTiempo(m.t); return; }
        m.t = s; e.target.value = infFormatoTiempo(s);
        if (player) { player.ir(s); player.pausar(); }
        refrescar();
      });
      ed.querySelectorAll('.anot-color').forEach(b => b.addEventListener('click', () => {
        ed.querySelectorAll('.anot-color').forEach(x => x.classList.toggle('active', x === b));
        m.c = b.dataset.color; refrescar();
      }));
      q('.vv-quitar').addEventListener('click', () => {
        if ((m.texto.trim() || m.formas.length) && !confirm(t('inf.confirmQuitarSeccion'))) return;
        if (dibujando) salirDibujo();
        marcas = marcas.filter(x => x !== m);
        activa = null; ed.hidden = true; ed.innerHTML = '';
        mostrada = null; anot.setFormas([]); pintarLista(); cambio();
      });
      if (window.autoCrecer) window.autoCrecer(q('.vv-nota'));
    }

    if (editable) {
      $('.vv-add').addEventListener('click', () => {
        if (necesitaVideo()) return;
        player.pausar();
        const m = nuevaMarca(Math.floor(player.ahora()), 'gol');
        if (dibujando) { anot.setFormas(m.formas); }
        pintarLista();
        abrirEditor(m);
        const sel = cont.querySelector('.vv-tipo'); if (sel) sel.focus();
      });
      $('.vv-draw').addEventListener('click', () => { if (dibujando) salirDibujo(); else entrarDibujo(); });
    }

    pintarLista();

    return {
      setFuente,
      setMarcas(lista) { marcas = (lista || []).map(normalizarMarca); activa = null; mostrada = null; pintarLista(); },
      getMarcas() {
        if (dibujando) { const m = marcaActiva(); if (m) m.formas = anot.getFormas(); }
        return marcas.slice().sort((a, b) => a.t - b.t).map(m => ({ ...m, formas: JSON.parse(JSON.stringify(m.formas)) }));
      },
      hayVideo() { return !!player; },
      destruir() { limpiarFuente(); }
    };
  }

  // Fotogramas con los dibujos de cada etiqueta (para exportar). Solo con vídeos accesibles (subidos o del dispositivo).
  function fotogramas(url, marcas, maximo) {
    const conDibujo = (marcas || []).filter(m => m.formas && m.formas.length).slice(0, maximo || 12);
    if (!url || !conDibujo.length) return Promise.resolve({});
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.playsInline = true;
      const salida = {};
      let i = 0, terminado = false;
      const fin = () => { if (terminado) return; terminado = true; v.removeAttribute('src'); v.load(); resolve(salida); };
      const limite = setTimeout(fin, 20000);
      const siguiente = () => {
        if (i >= conDibujo.length) { clearTimeout(limite); fin(); return; }
        v.currentTime = Math.min(conDibujo[i].t + 0.05, Math.max(0, (v.duration || 1e9) - 0.1));
      };
      v.addEventListener('seeked', () => {
        try {
          const esc = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(v.videoWidth * esc); c.height = Math.round(v.videoHeight * esc);
          const ctx = c.getContext('2d');
          ctx.drawImage(v, 0, 0, c.width, c.height);
          Anotador.dibujarFormas(ctx, conDibujo[i].formas, c.width, c.height);
          salida[conDibujo[i].id] = c.toDataURL('image/jpeg', 0.85);
        } catch (e) { clearTimeout(limite); fin(); return; }
        i++; siguiente();
      });
      v.addEventListener('loadeddata', siguiente, { once: true });
      v.addEventListener('error', () => { clearTimeout(limite); fin(); });
      v.src = url;
    });
  }

  window.VideoVisor = { crear, fotogramas, etiquetaMarca, iconoMarca, normalizarMarca, TIPOS };
})(window);
