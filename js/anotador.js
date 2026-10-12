// Editor de dibujo sobre una imagen o sobre un vídeo.
// Todas las figuras se pueden seleccionar después para moverlas, cambiar su tamaño, color y grosor.
// Coordenadas relativas (0-1): se ven igual a cualquier tamaño de pantalla o exportación.
(function (window) {
  const MAX_LADO = 1600;
  const CAJAS = ['rect', 'square', 'ellipse', 'circle', 'spot'];
  const LINEAS = ['arrow', 'line'];
  const COLORES = ['#E53935', '#FDD835', '#1E88E5', '#43A047', '#FFFFFF', '#111111'];
  let contador = 0;
  const nuevoId = () => 'f' + Date.now().toString(36) + (contador++).toString(36);

  // Convierte las figuras guardadas con el formato anterior
  function normalizar(f) {
    if (!f || typeof f !== 'object') return null;
    if (f.x1 !== undefined || (f.k === 'pen' && f.id)) return f;
    const o = { id: nuevoId(), c: f.c || COLORES[0], w: f.w || 0.006 };
    if (f.k === 'pen') return { ...o, k: 'pen', pts: f.pts || [] };
    if (f.k === 'arrow' && f.a && f.b) return { ...o, k: 'arrow', x1: f.a[0], y1: f.a[1], x2: f.b[0], y2: f.b[1] };
    if (f.k === 'circle' && f.a && f.b) return { ...o, k: 'ellipse', x1: f.a[0], y1: f.a[1], x2: f.b[0], y2: f.b[1] };
    if (f.k === 'text' && f.a) return { ...o, k: 'text', x1: f.a[0], y1: f.a[1], t: f.t || '', s: f.s || 0.035 };
    return null;
  }

  function alfa(hex, a) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function caja(f, w, h) {
    const x = Math.min(f.x1, f.x2) * w, y = Math.min(f.y1, f.y2) * h;
    const bw = Math.abs(f.x2 - f.x1) * w, bh = Math.abs(f.y2 - f.y1) * h;
    return { x, y, w: bw, h: bh, cx: x + bw / 2, cy: y + bh / 2, rx: bw / 2, ry: bh / 2 };
  }

  function fuenteTexto(f, base) { return `800 ${Math.max(10, (f.s || 0.035) * base)}px Inter, system-ui, sans-serif`; }

  function cajaTexto(ctx, f, w, h, base) {
    ctx.save(); ctx.font = fuenteTexto(f, base);
    const ancho = ctx.measureText(f.t || ' ').width, alto = (f.s || 0.035) * base;
    ctx.restore();
    return { x: f.x1 * w, y: f.y1 * h - alto * 0.6, w: ancho, h: alto * 1.2 };
  }

  function cajaPen(f, w, h) {
    const xs = f.pts.map(p => p[0] * w), ys = f.pts.map(p => p[1] * h);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  function trazar(ctx, f, w, h, base) {
    const g = Math.max(1.5, (f.w || 0.006) * base);
    ctx.strokeStyle = f.c; ctx.fillStyle = f.c; ctx.lineWidth = g;
    ctx.setLineDash(f.d ? [g * 2.4, g * 1.8] : []);
    if (f.k === 'pen' && f.pts && f.pts.length > 1) {
      ctx.beginPath(); ctx.moveTo(f.pts[0][0] * w, f.pts[0][1] * h);
      f.pts.forEach(p => ctx.lineTo(p[0] * w, p[1] * h)); ctx.stroke();
    } else if (LINEAS.includes(f.k)) {
      const x1 = f.x1 * w, y1 = f.y1 * h, x2 = f.x2 * w, y2 = f.y2 * h;
      if (f.k === 'arrow') {
        const ang = Math.atan2(y2 - y1, x2 - x1), punta = Math.max(g * 4, 12);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(ang) * punta * 0.7, y2 - Math.sin(ang) * punta * 0.7); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - punta * Math.cos(ang - 0.42), y2 - punta * Math.sin(ang - 0.42));
        ctx.lineTo(x2 - punta * Math.cos(ang + 0.42), y2 - punta * Math.sin(ang + 0.42));
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    } else if (f.k === 'rect' || f.k === 'square') {
      const b = caja(f, w, h);
      if (f.f) { ctx.fillStyle = alfa(f.c, 0.28); ctx.fillRect(b.x, b.y, b.w, b.h); }
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    } else if (f.k === 'ellipse' || f.k === 'circle') {
      const b = caja(f, w, h);
      ctx.beginPath(); ctx.ellipse(b.cx, b.cy, Math.max(1, b.rx), Math.max(1, b.ry), 0, 0, Math.PI * 2);
      if (f.f) { ctx.fillStyle = alfa(f.c, 0.28); ctx.fill(); }
      ctx.stroke();
    } else if (f.k === 'text' && f.t) {
      ctx.setLineDash([]);
      ctx.font = fuenteTexto(f, base);
      ctx.textBaseline = 'middle';
      const tam = (f.s || 0.035) * base;
      ctx.lineWidth = Math.max(3, tam / 5);
      ctx.strokeStyle = (f.c === '#FFFFFF' || f.c === '#FDD835') ? '#111111' : '#FFFFFF';
      ctx.strokeText(f.t, f.x1 * w, f.y1 * h);
      ctx.fillStyle = f.c;
      ctx.fillText(f.t, f.x1 * w, f.y1 * h);
    }
    ctx.setLineDash([]);
  }

  function puntosAsa(f, w, h) {
    if (LINEAS.includes(f.k)) return [{ id: 'p1', x: f.x1 * w, y: f.y1 * h }, { id: 'p2', x: f.x2 * w, y: f.y2 * h }];
    if (CAJAS.includes(f.k)) return [
      { id: 'a', x: f.x1 * w, y: f.y1 * h }, { id: 'b', x: f.x2 * w, y: f.y1 * h },
      { id: 'c', x: f.x1 * w, y: f.y2 * h }, { id: 'd', x: f.x2 * w, y: f.y2 * h }
    ];
    return [];
  }

  function dibujarSeleccion(ctx, f, w, h, base) {
    const tam = Math.max(7, base * 0.009);
    ctx.save();
    ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#FFFFFF';
    let b = null;
    if (CAJAS.includes(f.k)) b = caja(f, w, h);
    else if (f.k === 'text') b = cajaTexto(ctx, f, w, h, base);
    else if (f.k === 'pen' && f.pts.length) b = cajaPen(f, w, h);
    if (b) { ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); ctx.strokeStyle = '#111111'; ctx.lineDashOffset = 5; ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); }
    ctx.setLineDash([]);
    puntosAsa(f, w, h).forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, tam, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#111111'; ctx.stroke();
    });
    ctx.restore();
  }

  function dibujarFormas(ctx, formas, w, h, idSeleccion) {
    const lista = (formas || []).map(normalizar).filter(Boolean);
    const base = Math.max(w, h);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Focos: oscurecen todo menos su interior
    const focos = lista.filter(f => f.k === 'spot');
    if (focos.length && typeof document !== 'undefined') {
      const capa = document.createElement('canvas');
      capa.width = w; capa.height = h;
      const c2 = capa.getContext('2d');
      c2.fillStyle = 'rgba(0,0,0,0.55)'; c2.fillRect(0, 0, w, h);
      c2.globalCompositeOperation = 'destination-out';
      focos.forEach(f => { const b = caja(f, w, h); c2.beginPath(); c2.ellipse(b.cx, b.cy, Math.max(1, b.rx), Math.max(1, b.ry), 0, 0, Math.PI * 2); c2.fill(); });
      ctx.drawImage(capa, 0, 0);
      focos.forEach(f => {
        const b = caja(f, w, h);
        ctx.beginPath(); ctx.ellipse(b.cx, b.cy, Math.max(1, b.rx), Math.max(1, b.ry), 0, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(2, (f.w || 0.006) * base * 0.7); ctx.strokeStyle = f.c;
        ctx.setLineDash(f.d ? [8, 6] : []); ctx.stroke(); ctx.setLineDash([]);
      });
    }
    lista.forEach(f => { if (f.k !== 'spot') trazar(ctx, f, w, h, base); });
    if (idSeleccion) { const f = lista.find(x => x.id === idSeleccion); if (f) dibujarSeleccion(ctx, f, w, h, base); }
    ctx.restore();
  }

  function distSegmento(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
    let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function toca(ctx, f, px, py, w, h, tol) {
    const base = Math.max(w, h), g = (f.w || 0.006) * base;
    if (LINEAS.includes(f.k)) return distSegmento(px, py, f.x1 * w, f.y1 * h, f.x2 * w, f.y2 * h) <= Math.max(tol, g);
    if (f.k === 'pen') {
      for (let i = 1; i < f.pts.length; i++) {
        if (distSegmento(px, py, f.pts[i - 1][0] * w, f.pts[i - 1][1] * h, f.pts[i][0] * w, f.pts[i][1] * h) <= Math.max(tol, g)) return true;
      }
      return false;
    }
    const b = f.k === 'text' ? cajaTexto(ctx, f, w, h, base) : caja(f, w, h);
    return px >= b.x - tol && px <= b.x + b.w + tol && py >= b.y - tol && py <= b.y + b.h + tol;
  }

  // Carga una imagen y devuelve un JPEG con los dibujos encima (para exportar)
  function componer(url, formas, tipo) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const esc = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * esc); c.height = Math.round(img.naturalHeight * esc);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        dibujarFormas(ctx, formas, c.width, c.height);
        try { resolve(c.toDataURL(tipo || 'image/jpeg', 0.9)); } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // ---------- Editor ----------
  function init(canvas, opciones) {
    const ctx = canvas.getContext('2d');
    const opts = opciones || {};
    let imagen = null, tamanoLibre = !!opts.libre, activo = true;
    let formas = [], historial = [], rehechas = [];
    let sel = null, accion = null;
    let herramienta = 'arrow', color = COLORES[0], grosor = 0.006, discontinua = false, relleno = false, textoActual = '';
    let alSeleccionar = opts.onSelect || null;

    const W = () => canvas.width, H = () => canvas.height;
    const actual = () => formas.find(f => f.id === sel) || null;
    const escala = () => { const r = canvas.getBoundingClientRect(); return r.width ? canvas.width / r.width : 1; };

    function redibujar() {
      ctx.clearRect(0, 0, W(), H());
      if (imagen) ctx.drawImage(imagen, 0, 0, W(), H());
      dibujarFormas(ctx, formas, W(), H(), activo ? sel : null);
    }
    function cambio() { if (opts.onChange) opts.onChange(); }
    function guardar() { historial.push(JSON.stringify(formas)); if (historial.length > 80) historial.shift(); rehechas = []; }
    function seleccionar(id) { sel = id; if (alSeleccionar) alSeleccionar(actual()); }

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    }

    // Cuadrado y círculo: mismo tamaño en horizontal y vertical (en píxeles reales)
    function proporcion(f, fx, fy, mx, my) {
      const dx = (mx - fx) * W(), dy = (my - fy) * H();
      const lado = Math.max(Math.abs(dx), Math.abs(dy));
      return [fx + Math.sign(dx || 1) * lado / W(), fy + Math.sign(dy || 1) * lado / H()];
    }

    function ordenarCaja(f) {
      if (!CAJAS.includes(f.k)) return;
      const x1 = Math.min(f.x1, f.x2), x2 = Math.max(f.x1, f.x2), y1 = Math.min(f.y1, f.y2), y2 = Math.max(f.y1, f.y2);
      Object.assign(f, { x1, x2, y1, y2 });
    }

    function figuraEn(px, py, tol) {
      for (let i = formas.length - 1; i >= 0; i--) if (toca(ctx, formas[i], px, py, W(), H(), tol)) return formas[i];
      return null;
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!activo || (!imagen && !tamanoLibre) || !W()) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      const p = pos(e), px = p[0] * W(), py = p[1] * H(), tol = 14 * escala();
      const s = actual();

      // Asas de la figura seleccionada: cambiar tamaño o extremos
      if (s) {
        const asa = puntosAsa(s, W(), H()).find(a => Math.hypot(a.x - px, a.y - py) <= tol * 1.3);
        if (asa) { guardar(); accion = { tipo: 'asa', asa: asa.id, f: s }; return; }
      }
      // Mover: con la herramienta de selección o tocando la figura ya seleccionada
      if (herramienta === 'select' || (s && toca(ctx, s, px, py, W(), H(), tol))) {
        const f = herramienta === 'select' ? figuraEn(px, py, tol) : s;
        if (f) { seleccionar(f.id); guardar(); accion = { tipo: 'mover', f, inicio: p, orig: JSON.parse(JSON.stringify(f)), movido: false }; }
        else seleccionar(null);
        redibujar();
        return;
      }
      if (herramienta === 'text') {
        const texto = (textoActual || '').trim();
        if (!texto) { if (opts.onNeedText) opts.onNeedText(); return; }
        guardar();
        const f = { id: nuevoId(), k: 'text', c: color, w: grosor, s: 0.02 + grosor * 3, x1: p[0], y1: p[1], t: texto.slice(0, 80) };
        formas.push(f); seleccionar(f.id); redibujar(); cambio();
        return;
      }
      guardar();
      const f = herramienta === 'pen'
        ? { id: nuevoId(), k: 'pen', c: color, w: grosor, d: discontinua, pts: [p] }
        : { id: nuevoId(), k: herramienta, c: color, w: grosor, d: discontinua, f: relleno, x1: p[0], y1: p[1], x2: p[0], y2: p[1] };
      formas.push(f);
      accion = { tipo: 'crear', f };
      sel = f.id;
      redibujar();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!accion) return;
      e.preventDefault();
      const p = pos(e), f = accion.f;
      if (accion.tipo === 'crear') {
        if (f.k === 'pen') f.pts.push(p);
        else if (f.k === 'square' || f.k === 'circle') [f.x2, f.y2] = proporcion(f, f.x1, f.y1, p[0], p[1]);
        else { f.x2 = p[0]; f.y2 = p[1]; }
      } else if (accion.tipo === 'mover') {
        const dx = p[0] - accion.inicio[0], dy = p[1] - accion.inicio[1], o = accion.orig;
        if (Math.abs(dx) + Math.abs(dy) > 0.002) accion.movido = true;
        if (f.k === 'pen') f.pts = o.pts.map(q => [q[0] + dx, q[1] + dy]);
        else { f.x1 = o.x1 + dx; f.y1 = o.y1 + dy; if (f.x2 !== undefined) { f.x2 = o.x2 + dx; f.y2 = o.y2 + dy; } }
      } else if (accion.tipo === 'asa') {
        const a = accion.asa;
        if (a === 'p1') { f.x1 = p[0]; f.y1 = p[1]; }
        else if (a === 'p2') { f.x2 = p[0]; f.y2 = p[1]; }
        else {
          // la esquina opuesta queda fija
          const fija = { a: [f.x2, f.y2], b: [f.x1, f.y2], c: [f.x2, f.y1], d: [f.x1, f.y1] }[a];
          let m = [p[0], p[1]];
          if (f.k === 'square' || f.k === 'circle') m = proporcion(f, fija[0], fija[1], p[0], p[1]);
          f.x1 = fija[0]; f.y1 = fija[1]; f.x2 = m[0]; f.y2 = m[1];
          ordenarCaja(f);
          const nueva = puntosAsa(f, W(), H()).reduce((best, q) => {
            const d = Math.hypot(q.x - m[0] * W(), q.y - m[1] * H());
            return !best || d < best.d ? { id: q.id, d } : best;
          }, null);
          accion.asa = nueva.id;
        }
      }
      redibujar();
    });

    function terminar() {
      if (!accion) return;
      const { tipo, f } = accion;
      if (tipo === 'crear') {
        const valida = f.k === 'pen' ? f.pts.length > 2
          : Math.hypot((f.x2 - f.x1) * W(), (f.y2 - f.y1) * H()) > 8 * escala();
        if (!valida) { formas = formas.filter(x => x !== f); historial.pop(); sel = null; }
        else { ordenarCaja(f); seleccionar(f.id); cambio(); }
      } else if (tipo === 'mover' && !accion.movido) {
        historial.pop();
      } else {
        ordenarCaja(f); cambio();
      }
      accion = null;
      redibujar();
    }
    canvas.addEventListener('pointerup', terminar);
    canvas.addEventListener('pointercancel', terminar);

    // Cambiar una propiedad de la figura seleccionada
    function aplicar(fn) { const s = actual(); if (!s) return; guardar(); fn(s); redibujar(); cambio(); }

    return {
      setImagen(img) {
        imagen = img;
        const esc = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.round(img.naturalWidth * esc); canvas.height = Math.round(img.naturalHeight * esc);
        redibujar();
      },
      setTamano(w, h) { tamanoLibre = true; canvas.width = Math.max(1, Math.round(w)); canvas.height = Math.max(1, Math.round(h)); redibujar(); },
      quitarImagen() { imagen = null; canvas.width = 0; canvas.height = 0; },
      tieneImagen() { return !!imagen; },
      setActivo(v) { activo = !!v; if (!activo) { accion = null; } redibujar(); },
      setFormas(lista) { formas = (Array.isArray(lista) ? lista : []).map(normalizar).filter(Boolean).map(f => JSON.parse(JSON.stringify(f))); historial = []; rehechas = []; seleccionar(null); redibujar(); },
      getFormas() { return JSON.parse(JSON.stringify(formas)); },
      setHerramienta(h) { herramienta = h; },
      getHerramienta() { return herramienta; },
      setColor(c) { color = c; aplicar(s => { s.c = c; }); },
      setGrosor(g) { grosor = g; aplicar(s => { s.w = g; if (s.k === 'text') s.s = 0.02 + g * 3; }); },
      setDiscontinua(v) { discontinua = !!v; aplicar(s => { s.d = discontinua; }); },
      setRelleno(v) { relleno = !!v; aplicar(s => { s.f = relleno; }); },
      setTexto(tx) { textoActual = tx; const s = actual(); if (s && s.k === 'text' && tx.trim()) { s.t = tx.slice(0, 80); redibujar(); cambio(); } },
      setOnSelect(fn) { alSeleccionar = fn; },
      seleccionada() { return actual(); },
      deseleccionar() { seleccionar(null); redibujar(); },
      duplicar() {
        const s = actual(); if (!s) return;
        guardar();
        const c = JSON.parse(JSON.stringify(s)); c.id = nuevoId();
        if (c.k === 'pen') c.pts = c.pts.map(q => [q[0] + 0.03, q[1] + 0.03]);
        else { c.x1 += 0.03; c.y1 += 0.03; if (c.x2 !== undefined) { c.x2 += 0.03; c.y2 += 0.03; } }
        formas.push(c); seleccionar(c.id); redibujar(); cambio();
      },
      borrarSeleccionada() { const s = actual(); if (!s) return; guardar(); formas = formas.filter(f => f !== s); seleccionar(null); redibujar(); cambio(); },
      deshacer() { if (!historial.length) return; rehechas.push(JSON.stringify(formas)); formas = JSON.parse(historial.pop()); if (!actual()) seleccionar(null); redibujar(); cambio(); },
      rehacer() { if (!rehechas.length) return; historial.push(JSON.stringify(formas)); formas = JSON.parse(rehechas.pop()); redibujar(); cambio(); },
      limpiar() { if (!formas.length) return; guardar(); formas = []; seleccionar(null); redibujar(); cambio(); },
      redibujar
    };
  }

  // ---------- Barra de herramientas (la misma para capturas y vídeo) ----------
  const HERRAMIENTAS = [
    ['select', '↖', 'inf.herrSeleccionar'], ['arrow', '➜', 'inf.herrFlecha'], ['line', '╱', 'inf.herrLinea'],
    ['rect', '▭', 'inf.herrRect'], ['square', '□', 'inf.herrCuadrado'], ['ellipse', '⬭', 'inf.herrElipse'],
    ['circle', '○', 'inf.herrCirculo'], ['spot', '◎', 'inf.herrFoco'], ['pen', '✎', 'inf.herrLapiz'], ['text', 'T', 'inf.herrTexto']
  ];

  function barra(cont, anot, opciones) {
    const op = opciones || {};
    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    cont.innerHTML = `
      <div class="toolbar-row anot-herrs">${HERRAMIENTAS.map(([k, ic, clave]) =>
        `<button type="button" class="tool-btn anot-herr${k === 'arrow' ? ' active' : ''}" data-herr="${k}"><span class="anot-ic">${ic}</span> <span data-i18n="${clave}">${esc(t(clave))}</span></button>`).join('')}</div>
      <div class="toolbar-row anot-fila-color">
        ${COLORES.map((c, i) => `<button type="button" class="anot-color${i === 0 ? ' active' : ''}" data-color="${c}" style="--sw:${c}" aria-label="${c}"></button>`).join('')}
        <span class="anot-sep"></span>
        ${[0.004, 0.006, 0.010].map((g, i) => `<button type="button" class="anot-grosor${i === 1 ? ' active' : ''}" data-grosor="${g}" aria-label="${i + 1}"><i style="--d:${[5, 8, 12][i]}px"></i></button>`).join('')}
      </div>
      <div class="toolbar-row">
        <button type="button" class="tool-btn anot-toggle" data-toggle="d" data-i18n="inf.discontinua">${esc(t('inf.discontinua'))}</button>
        <button type="button" class="tool-btn anot-toggle" data-toggle="f" data-i18n="inf.relleno">${esc(t('inf.relleno'))}</button>
      </div>
      <div class="toolbar-row anot-texto-fila" hidden>
        <input type="text" class="anot-texto" maxlength="80" placeholder="${esc(t('inf.textoPh'))}" data-i18n-placeholder="inf.textoPh">
      </div>
      <div class="toolbar-row">
        <button type="button" class="tool-btn" data-acc="deshacer" data-i18n="pz.deshacer">${esc(t('pz.deshacer'))}</button>
        <button type="button" class="tool-btn" data-acc="rehacer" data-i18n="pz.ui.redo">${esc(t('pz.ui.redo'))}</button>
        <button type="button" class="tool-btn" data-acc="duplicar" data-i18n="inf.duplicar" disabled>${esc(t('inf.duplicar'))}</button>
        <button type="button" class="tool-btn" data-acc="borrarSel" data-i18n="inf.borrarSel" disabled>${esc(t('inf.borrarSel'))}</button>
        <button type="button" class="tool-btn" data-acc="limpiar" data-i18n="inf.borrarDibujos">${esc(t('inf.borrarDibujos'))}</button>
      </div>
      <p class="tags-sug-label" data-i18n="inf.ayudaSel">${esc(t('inf.ayudaSel'))}</p>`;

    const q = (s) => cont.querySelectorAll(s);
    const filaTexto = cont.querySelector('.anot-texto-fila'), inputTexto = cont.querySelector('.anot-texto');
    const marcar = (sel, fn) => q(sel).forEach(b => b.classList.toggle('active', fn(b)));

    q('.anot-herr').forEach(b => b.addEventListener('click', () => {
      marcar('.anot-herr', x => x === b);
      anot.setHerramienta(b.dataset.herr);
      if (b.dataset.herr !== 'select') anot.deseleccionar();
      filaTexto.hidden = b.dataset.herr !== 'text';
      if (b.dataset.herr === 'text') inputTexto.focus();
    }));
    q('.anot-color').forEach(b => b.addEventListener('click', () => { marcar('.anot-color', x => x === b); anot.setColor(b.dataset.color); }));
    q('.anot-grosor').forEach(b => b.addEventListener('click', () => { marcar('.anot-grosor', x => x === b); anot.setGrosor(parseFloat(b.dataset.grosor)); }));
    q('.anot-toggle').forEach(b => b.addEventListener('click', () => {
      b.classList.toggle('active');
      if (b.dataset.toggle === 'd') anot.setDiscontinua(b.classList.contains('active'));
      else anot.setRelleno(b.classList.contains('active'));
    }));
    inputTexto.addEventListener('input', () => anot.setTexto(inputTexto.value));
    q('[data-acc]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.acc;
      if (a === 'limpiar') { if (op.confirmarLimpiar && !op.confirmarLimpiar()) return; anot.limpiar(); }
      else if (a === 'borrarSel') anot.borrarSeleccionada();
      else anot[a]();
    }));

    // Al seleccionar una figura, la barra muestra sus propiedades
    anot.setOnSelect((f) => {
      q('[data-acc="duplicar"], [data-acc="borrarSel"]').forEach(b => { b.disabled = !f; });
      if (!f) { filaTexto.hidden = anot.getHerramienta() !== 'text'; return; }
      marcar('.anot-color', x => x.dataset.color === f.c);
      marcar('.anot-grosor', x => Math.abs(parseFloat(x.dataset.grosor) - (f.w || 0.006)) < 0.0005);
      marcar('.anot-toggle', x => (x.dataset.toggle === 'd' ? !!f.d : !!f.f));
      if (f.k === 'text') { filaTexto.hidden = false; inputTexto.value = f.t || ''; }
      else filaTexto.hidden = anot.getHerramienta() !== 'text';
    });
    return { input: inputTexto };
  }

  window.Anotador = { init, barra, dibujarFormas, componer, normalizar, COLORES };
})(window);
