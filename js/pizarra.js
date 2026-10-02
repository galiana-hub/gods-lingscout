/**
 * LingScout — Pizarra táctica
 * Motor de dibujo táctico con secuencia, flechas tipadas, zonas y plantillas.
 */
(function (window) {
  'use strict';

  const SIZES = {
    vertical: { w: 420, h: 680 },
    half: { w: 420, h: 340 },
    horizontal: { w: 680, h: 420 }
  };

  const ZONE_COLORS = {
    pressure: 'rgba(211, 47, 47, 0.28)',
    influence: 'rgba(25, 118, 210, 0.22)',
    free: 'rgba(46, 125, 50, 0.25)',
    danger: 'rgba(245, 124, 0, 0.28)',
    corridor: 'rgba(123, 31, 162, 0.22)'
  };

  const LINE_STYLES = {
    pass: { color: '#1565C0', width: 1.8, dash: [6, 5] },
    coverage: { color: '#C62828', width: 2, dash: [10, 4] },
    support: { color: '#2E7D32', width: 1.8, dash: [3, 4] },
    connection: { color: '#6A1B9A', width: 1.5, dash: [] },
    defensive: { color: '#263238', width: 3, dash: [] },
    pressure: { color: '#D32F2F', width: 2.5, dash: [8, 5] },
    offside: { color: '#F57C00', width: 2, dash: [5, 5] },
    orientation: { color: '#00838F', width: 2, dash: [2, 5] }
  };

  function uid() {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function Board(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pitchType = 'vertical';
    this.tool = 'select';
    this.arrowStyle = 'solid';   // solid | dashed | double | numbered | feint
    this.arrowWidth = 2.5;       // thickness
    this.zoneType = 'pressure';
    this.zoneShape = 'circle';
    this.textSize = 15;
    this.passStyle = 'dashed';
    this.movementStyle = 'solid';
    this.lineType = 'pass';
    this.tokenTeam = 'own';      // own | rival | ball
    this.nextNumber = 1;
    this.elements = [];
    this.history = [];
    this.redoHistory = [];
    this.stepFilter = null;      // null = show all; number = only up to that step
    this.currentStep = 1;
    this.maxStep = 1;
    this.playing = false;
    this.playTimer = null;
    this.draft = null;           // in-progress shape
    this.selectedId = null;
    this.dragId = null;
    this.dragOff = null;
    this.onChange = opts && opts.onChange || function () {};

    this._bind();
    this._resize();
    this.redraw();
  }

  Board.prototype._bind = function () {
    const c = this.canvas;
    c.addEventListener('mousedown', this._onDown.bind(this));
    c.addEventListener('mousemove', this._onMove.bind(this));
    c.addEventListener('mouseup', this._onUp.bind(this));
    c.addEventListener('mouseleave', this._onUp.bind(this));
    c.addEventListener('touchstart', this._onDown.bind(this), { passive: false });
    c.addEventListener('touchmove', this._onMove.bind(this), { passive: false });
    c.addEventListener('touchend', this._onUp.bind(this));
  };

  Board.prototype._resize = function () {
    const s = SIZES[this.pitchType] || SIZES.vertical;
    this.canvas.width = s.w;
    this.canvas.height = s.h;
  };

  Board.prototype.setPitch = function (type) {
    this.pitchType = type;
    this._resize();
    this.redraw();
    this.onChange();
  };

  Board.prototype.setTool = function (tool) {
    this.tool = tool;
    this.draft = null;
  };

  Board.prototype.pushHistory = function () {
    this.history.push(JSON.stringify(this.elements));
    if (this.history.length > 50) this.history.shift();
    this.redoHistory = [];
  };

  Board.prototype.redo = function () {
    if (!this.redoHistory.length) return;
    this.history.push(JSON.stringify(this.elements));
    this.elements = JSON.parse(this.redoHistory.pop());
    this._recalcSteps();
    this.redraw();
    this.onChange();
  };

  Board.prototype.undo = function () {
    if (!this.history.length) return;
    this.redoHistory.push(JSON.stringify(this.elements));
    this.elements = JSON.parse(this.history.pop());
    this._recalcSteps();
    this.redraw();
    this.onChange();
  };

  Board.prototype.clear = function () {
    this.pushHistory();
    this.elements = [];
    this.nextNumber = 1;
    this.currentStep = 1;
    this.maxStep = 1;
    this.draft = null;
    this.selectedId = null;
    this.redraw();
    this.onChange();
  };

  Board.prototype._recalcSteps = function () {
    let max = 1;
    this.elements.forEach(el => {
      if (el.step && el.step > max) max = el.step;
    });
    this.maxStep = max;
    if (this.currentStep > max) this.currentStep = max;
  };

  Board.prototype.pos = function (e) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (cx - rect.left) * (this.canvas.width / rect.width),
      y: (cy - rect.top) * (this.canvas.height / rect.height)
    };
  };

  Board.prototype._hitTest = function (p) {
    const distToSegment = (px, py, x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((px - x1) * dx + (py - y1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const x = x1 + t * dx, y = y1 + t * dy;
      return Math.hypot(px - x, py - y);
    };
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (!this._visible(el)) continue;
      if (el.type === 'text') {
      ctx.fillStyle = '#111111';
      ctx.font = `600 ${el.size || 15}px Inter, sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(el.text || '', el.x, el.y);
      if (el.id === this.selectedId) {
        const width = ctx.measureText(el.text || '').width;
        ctx.strokeStyle = '#FFD54F'; ctx.lineWidth = 2; ctx.strokeRect(el.x - 5, el.y - (el.size || 15) - 4, width + 10, (el.size || 15) + 9);
      }
      return;
    }

    if (el.type === 'token') {
        if (Math.hypot(el.x - p.x, el.y - p.y) <= 18) return el;
      } else if (el.type === 'zone') {
        if (el.shape === 'rect') {
          const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2);
          const w = Math.abs(el.x2 - el.x1), h = Math.abs(el.y2 - el.y1);
          if (p.x >= x - 8 && p.x <= x + w + 8 && p.y >= y - 8 && p.y <= y + h + 8) return el;
        } else if (Math.hypot(el.x - p.x, el.y - p.y) <= (el.r || 14) + 8) return el;
      } else if (el.type === 'arrow' || el.type === 'line') {
        if (distToSegment(p.x, p.y, el.x1, el.y1, el.x2, el.y2) <= 10) return el;
      } else if (el.type === 'text') {
        const width = el.width || Math.max(40, String(el.text || '').length * 7);
        if (p.x >= el.x - 6 && p.x <= el.x + width && p.y >= el.y - 18 && p.y <= el.y + 8) return el;
      }
    }
    return null;
  };

  Board.prototype.findNear = function (p, r) { return this._hitTest(p) || null; };

  Board.prototype._deleteElement = function (id) {
    const before = this.elements.length;
    this.pushHistory();
    this.elements = this.elements.filter(x => x.id !== id);
    if (this.elements.length === before) return false;
    if (this.selectedId === id) this.selectedId = null;
    this._recalcSteps();
    this.redraw();
    this.onChange();
    return true;
  };

  Board.prototype.deleteSelected = function () {
    if (this.selectedId) this._deleteElement(this.selectedId);
  };

  Board.prototype.duplicateSelected = function () {
    const el = this.elements.find(x => x.id === this.selectedId);
    if (!el) return;
    this.pushHistory();
    const copy = JSON.parse(JSON.stringify(el));
    copy.id = uid();
    if (copy.type === 'token' || (copy.type === 'zone' && copy.shape !== 'rect')) { copy.x += 18; copy.y += 18; }
    if (copy.type === 'zone' && copy.shape === 'rect') { copy.x1 += 18; copy.y1 += 18; copy.x2 += 18; copy.y2 += 18; }
    if (copy.type === 'arrow' || copy.type === 'line') { copy.x1 += 18; copy.y1 += 18; copy.x2 += 18; copy.y2 += 18; }
    if (copy.type === 'text') { copy.x += 18; copy.y += 18; }
    this.elements.push(copy);
    this.selectedId = copy.id;
    this.redraw();
    this.onChange();
  };

  Board.prototype._onDown = function (e) {
    e.preventDefault();
    const p = this.pos(e);
    const tool = this.tool;

    if (tool === 'select' || tool === 'erase') {
      const hit = this._hitTest(p);
      if (tool === 'erase') {
        if (hit) this._deleteElement(hit.id);
        return;
      }
      this.selectedId = hit ? hit.id : null;
      if (hit && ['token','text','zone','arrow','line'].includes(hit.type)) {
        this.pushHistory();
        this.dragId = hit.id;
        this.dragStart = { x: p.x, y: p.y };
        if (hit.type === 'token' || hit.type === 'text' || (hit.type === 'zone' && hit.shape !== 'rect')) {
          this.dragOff = { x: p.x - hit.x, y: p.y - hit.y };
        } else if (hit.type === 'zone') {
          this.dragOff = { x: p.x - hit.x1, y: p.y - hit.y1 };
        } else {
          this.dragOff = { x: p.x - hit.x1, y: p.y - hit.y1 };
        }
      }
      this.redraw();
      return;
    }

    if (tool === 'token') {
      this.pushHistory();
      const el = {
        id: uid(), type: 'token', team: this.tokenTeam, x: p.x, y: p.y,
        number: this.tokenTeam === 'ball' ? null : this.nextNumber,
        name: '', position: '',
        step: this.currentStep
      };
      if (this.tokenTeam !== 'ball') this.nextNumber++;
      this.elements.push(el);
      this.selectedId = el.id;
      this.dragId = el.id;
      this.dragOff = { x: 0, y: 0 };
      this._recalcSteps(); this.redraw(); this.onChange();
      return;
    }

    if (tool === 'text') {
      const value = window.prompt('Texto táctico:');
      if (!value || !value.trim()) return;
      this.pushHistory();
      const el = { id: uid(), type: 'text', text: value.trim(), x: p.x, y: p.y, size: this.textSize || 15, step: this.currentStep };
      this.elements.push(el); this.selectedId = el.id;
      this.redraw(); this.onChange();
      return;
    }

    if (tool === 'arrow' || tool === 'line' || tool === 'pass' || tool === 'movement') {
      const kind = tool === 'line' ? 'line' : 'arrow';
      const style = tool === 'pass' ? (this.passStyle || 'dashed') : (tool === 'movement' ? (this.movementStyle || 'solid') : (tool === 'arrow' ? this.arrowStyle : this.lineType));
      this.draft = { kind, style, width: this.arrowWidth, x1: p.x, y1: p.y, x2: p.x, y2: p.y, step: this.currentStep,
        seq: kind === 'arrow' && style === 'numbered' ? this._nextSeq() : null };
      return;
    }

    if (tool === 'zone') {
      if (this.zoneShape === 'rect') {
        this.draft = { kind: 'zone', shape: 'rect', zoneType: this.zoneType, x1: p.x, y1: p.y, x2: p.x, y2: p.y, step: this.currentStep };
      } else {
        this.draft = { kind: 'zone', shape: 'circle', zoneType: this.zoneType, x: p.x, y: p.y, r: 8, step: this.currentStep };
      }
    }
  };

  Board.prototype._nextSeq = function () {
    let n = 0;
    this.elements.forEach(el => {
      if (el.type === 'arrow' && el.style === 'numbered' && el.seq > n) n = el.seq;
    });
    return n + 1;
  };

  Board.prototype._onMove = function (e) {
    if (this.dragId) {
      e.preventDefault();
      const p = this.pos(e);
      const el = this.elements.find(x => x.id === this.dragId);
      if (el) {
        const dx = p.x - this.dragOff.x;
        const dy = p.y - this.dragOff.y;
        if (el.type === 'token' || el.type === 'text' || (el.type === 'zone' && el.shape !== 'rect')) {
          el.x = dx; el.y = dy;
        } else if (el.type === 'zone') {
          const shiftX = dx - el.x1, shiftY = dy - el.y1;
          el.x1 += shiftX; el.x2 += shiftX; el.y1 += shiftY; el.y2 += shiftY;
        } else {
          const shiftX = dx - el.x1, shiftY = dy - el.y1;
          el.x1 += shiftX; el.x2 += shiftX; el.y1 += shiftY; el.y2 += shiftY;
        }
        this.redraw();
      }
      return;
    }
    if (!this.draft) return;
    e.preventDefault();
    const p = this.pos(e);
    if (this.draft.kind === 'arrow' || this.draft.kind === 'line') {
      this.draft.x2 = p.x;
      this.draft.y2 = p.y;
    } else if (this.draft.kind === 'zone') {
      if (this.draft.shape === 'rect') {
        this.draft.x2 = p.x; this.draft.y2 = p.y;
      } else {
        this.draft.r = Math.max(12, Math.hypot(p.x - this.draft.x, p.y - this.draft.y));
      }
    }
    this.redraw();
  };

  Board.prototype._onUp = function () {
    if (this.dragId) {
      this.dragId = null;
      this.dragOff = null;
      this.dragStart = null;
      this.onChange();
      return;
    }
    if (!this.draft) return;
    const d = this.draft;
    this.draft = null;

    if (d.kind === 'arrow' || d.kind === 'line') {
      if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 8) {
        this.redraw();
        return;
      }
      this.pushHistory();
      this.elements.push({
        id: uid(),
        type: d.kind,
        style: d.style,
        width: d.width || 2.5,
        x1: d.x1, y1: d.y1,
        x2: d.x2, y2: d.y2,
        step: d.step,
        seq: d.seq
      });
    } else if (d.kind === 'zone') {
      const size = d.shape === 'rect' ? Math.max(Math.abs(d.x2 - d.x1), Math.abs(d.y2 - d.y1)) : d.r;
      if (size < 14) { this.redraw(); return; }
      this.pushHistory();
      if (d.shape === 'rect') {
        this.elements.push({ id: uid(), type: 'zone', shape: 'rect', zoneType: d.zoneType,
          x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, step: d.step });
      } else {
        this.elements.push({ id: uid(), type: 'zone', shape: 'circle', zoneType: d.zoneType,
          x: d.x, y: d.y, r: d.r, step: d.step });
      }
    }
    this._recalcSteps();
    this.redraw();
    this.onChange();
  };

  // ---------- Drawing ----------
  Board.prototype.drawPitch = function () {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Césped: franjas siempre siguen la orientación real del campo.
    const stripes = this.pitchType === 'horizontal' ? 12 : 10;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#3c8d4c' : '#438f53';
      if (this.pitchType === 'horizontal') {
        const x = i * w / stripes;
        ctx.fillRect(x, 0, w / stripes + 1, h);
      } else {
        const y = i * h / stripes;
        ctx.fillRect(0, y, w, h / stripes + 1);
      }
    }

    const inset = 5;
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    const fieldW = x1 - x0, fieldH = y1 - y0;

    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x0, y0, fieldW, fieldH);

    const drawGoalEnd = (side) => {
      const penaltyW = Math.min(fieldW * 0.45, 190);
      const goalW = Math.min(fieldW * 0.20, 86);
      const penaltyD = Math.min(fieldH * 0.135, 92);
      const goalD = Math.min(penaltyD * 0.48, 44);
      const px = (w - penaltyW) / 2;
      const gx = (w - goalW) / 2;
      const top = side === 'top';
      const py = top ? y0 : y1 - penaltyD;
      const gy = top ? y0 : y1 - goalD;

      ctx.strokeRect(px, py, penaltyW, penaltyD);
      ctx.strokeRect(gx, gy, goalW, goalD);

      const spotY = top ? y0 + penaltyD : y1 - penaltyD;
      const arcStart = top ? 0.18 * Math.PI : 1.18 * Math.PI;
      const arcEnd = top ? 0.82 * Math.PI : 1.82 * Math.PI;
      ctx.beginPath();
      ctx.arc(w / 2, spotY, 42, arcStart, arcEnd);
      ctx.stroke();

      // Punto de penalti.
      ctx.beginPath();
      ctx.arc(w / 2, spotY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    };

    if (this.pitchType === 'vertical') {
      // Campo completo: dos mitades reales.
      ctx.beginPath();
      ctx.moveTo(x0, h / 2);
      ctx.lineTo(x1, h / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
      ctx.fill();

      drawGoalEnd('top');
      drawGoalEnd('bottom');
    } else if (this.pitchType === 'half') {
      // Medio campo: una mitad completa, sin líneas artificiales.
      drawGoalEnd('top');

      // Línea de medio campo en el extremo inferior y media circunferencia.
      ctx.beginPath();
      ctx.moveTo(x0, y1);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, y1, 58, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, y1, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Campo horizontal: el mismo campo completo girado 90°.
      const penaltyD = Math.min(fieldW * 0.135, 92);
      const goalD = Math.min(penaltyD * 0.48, 44);
      const penaltyH = Math.min(fieldH * 0.45, 190);
      const goalH = Math.min(fieldH * 0.20, 86);
      const py = (h - penaltyH) / 2;
      const gy = (h - goalH) / 2;
      const drawSide = (side) => {
        const left = side === 'left';
        const px = left ? x0 : x1 - penaltyD;
        const gx = left ? x0 : x1 - goalD;
        ctx.strokeRect(px, py, penaltyD, penaltyH);
        ctx.strokeRect(gx, gy, goalD, goalH);
        const spotX = left ? x0 + penaltyD : x1 - penaltyD;
        const arcStart = left ? -0.32 * Math.PI : 0.68 * Math.PI;
        const arcEnd = left ? 0.32 * Math.PI : 1.32 * Math.PI;
        ctx.beginPath();
        ctx.arc(spotX, h / 2, 42, arcStart, arcEnd);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(spotX, h / 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      };

      ctx.beginPath();
      ctx.moveTo(w / 2, y0);
      ctx.lineTo(w / 2, y1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      drawSide('left');
      drawSide('right');
    }
  };
  Board.prototype._visible = function (el) {
    if (this.stepFilter == null) return true;
    return !el.step || el.step <= this.stepFilter;
  };

  Board.prototype._drawArrowHead = function (x1, y1, x2, y2, size) {
    const ctx = this.ctx;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(ang - 0.4), y2 - size * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - size * Math.cos(ang + 0.4), y2 - size * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
  };

  Board.prototype._drawFeint = function (x1, y1, x2, y2, width) {
    const ctx = this.ctx;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.max(8, Math.floor(len / 8));
    const nx = -dy / len, ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const amp = Math.sin(t * Math.PI * 3) * (10 + width);
      const px = x1 + dx * t + nx * amp;
      const py = y1 + dy * t + ny * amp;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  };

  Board.prototype.drawElement = function (el) {
    const ctx = this.ctx;
    if (el.type === 'zone') {
      ctx.fillStyle = ZONE_COLORS[el.zoneType] || ZONE_COLORS.pressure;
      ctx.strokeStyle = (ZONE_COLORS[el.zoneType] || '').replace(/[\d.]+\)$/, '0.7)') || 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      if (el.shape === 'rect') {
        const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2);
        const w = Math.abs(el.x2 - el.x1), h = Math.abs(el.y2 - el.y1);
        ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
        if (el.id === this.selectedId) { ctx.setLineDash([]); ctx.strokeStyle = '#FFD54F'; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6); }
      } else {
        ctx.beginPath(); ctx.arc(el.x, el.y, el.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (el.id === this.selectedId) { ctx.setLineDash([]); ctx.strokeStyle = '#FFD54F'; ctx.lineWidth = 2; ctx.stroke(); }
      }
      ctx.setLineDash([]);
      return;
    }

    if (el.type === 'line') {
      const st = LINE_STYLES[el.style] || LINE_STYLES.pass;
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      ctx.setLineDash(st.dash);
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    if (el.type === 'arrow') {
      const w = el.width || 2.5;
      ctx.strokeStyle = '#111111';
      ctx.fillStyle = '#111111';
      ctx.lineWidth = w;
      ctx.lineCap = 'round';

      if (el.style === 'dashed') {
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        ctx.setLineDash([]);
        this._drawArrowHead(el.x1, el.y1, el.x2, el.y2, 8 + w);
      } else if (el.style === 'feint') {
        this._drawFeint(el.x1, el.y1, el.x2, el.y2, w);
        this._drawArrowHead(el.x1, el.y1, el.x2, el.y2, 8 + w);
      } else if (el.style === 'double') {
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        this._drawArrowHead(el.x1, el.y1, el.x2, el.y2, 8 + w);
        this._drawArrowHead(el.x2, el.y2, el.x1, el.y1, 8 + w);
      } else {
        // solid or numbered
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        this._drawArrowHead(el.x1, el.y1, el.x2, el.y2, 8 + w);
        if (el.style === 'numbered' && el.seq) {
          const mx = (el.x1 + el.x2) / 2;
          const my = (el.y1 + el.y2) / 2;
          ctx.beginPath();
          ctx.arc(mx, my, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#111111';
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(el.seq), mx, my + 0.5);
        }
      }
      return;
    }

    if (el.type === 'token') {
      if (el.team === 'ball') {
        ctx.beginPath();
        ctx.arc(el.x, el.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(el.x - 2, el.y - 2, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#111111';
        ctx.fill();
      } else if (el.team === 'own') {
        ctx.beginPath();
        ctx.arc(el.x, el.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#111111';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (el.number != null) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(el.number), el.x, el.y + 0.5);
        }
      } else {
        ctx.beginPath();
        ctx.arc(el.x, el.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (el.number != null) {
          ctx.fillStyle = '#111111';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(el.number), el.x, el.y + 0.5);
        }
      }
      if (el.team !== 'ball' && (el.name || el.position)) {
        ctx.fillStyle = '#111111'; ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(el.name || el.position, el.x, el.y + 15);
      }
      if (el.id === this.selectedId) {
        ctx.beginPath();
        ctx.arc(el.x, el.y, 16, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  };

  Board.prototype.redraw = function () {
    this.drawPitch();
    // zones first (under), then lines, arrows, tokens
    const order = ['zone', 'line', 'arrow', 'token'];
    order.forEach(tipo => {
      this.elements.forEach(el => {
        if (el.type === tipo && this._visible(el)) this.drawElement(el);
      });
    });
    if (this.draft) {
      if (this.draft.kind === 'zone') {
        this.drawElement(this.draft.shape === 'rect' ? {
          type: 'zone', shape: 'rect', zoneType: this.draft.zoneType,
          x1: this.draft.x1, y1: this.draft.y1, x2: this.draft.x2, y2: this.draft.y2
        } : {
          type: 'zone', shape: 'circle', zoneType: this.draft.zoneType,
          x: this.draft.x, y: this.draft.y, r: this.draft.r
        });
      } else if (this.draft.kind === 'arrow') {
        this.drawElement({
          type: 'arrow',
          style: this.draft.style,
          width: this.draft.width,
          x1: this.draft.x1, y1: this.draft.y1,
          x2: this.draft.x2, y2: this.draft.y2,
          seq: this.draft.seq
        });
      } else if (this.draft.kind === 'line') {
        this.drawElement({
          type: 'line',
          style: this.draft.style,
          x1: this.draft.x1, y1: this.draft.y1,
          x2: this.draft.x2, y2: this.draft.y2
        });
      }
    }
  };

  // ---------- Animation ----------
  Board.prototype.play = function (onTick) {
    if (this.playing) return;
    this.playing = true;
    this.stepFilter = 0;
    const self = this;
    const max = this.maxStep;
    let step = 0;
    this.playTimer = setInterval(() => {
      step++;
      self.stepFilter = step;
      self.redraw();
      if (onTick) onTick(step, max);
      if (step >= max) {
        self.stopPlay();
      }
    }, 900);
  };

  Board.prototype.stopPlay = function () {
    this.playing = false;
    if (this.playTimer) clearInterval(this.playTimer);
    this.playTimer = null;
    this.stepFilter = null;
    this.redraw();
  };

  Board.prototype.setStep = function (n) {
    this.currentStep = Math.max(1, n);
    if (this.currentStep > this.maxStep) this.maxStep = this.currentStep;
    this.onChange();
  };

  // ---------- Serialize ----------
  Board.prototype.toJSON = function () {
    return {
      pitchType: this.pitchType,
      elements: this.elements,
      nextNumber: this.nextNumber,
      currentStep: this.currentStep,
      maxStep: this.maxStep,
      zoneShape: this.zoneShape || 'circle',
      textSize: this.textSize || 15
    };
  };

  Board.prototype.loadJSON = function (data) {
    if (!data) return;
    this.pitchType = data.pitchType || 'vertical';
    this.elements = (data.elements || []).map(el => el.type === 'zone' && !el.shape ? Object.assign({ shape: 'circle' }, el) : el);
    this.redoHistory = [];
    this.nextNumber = data.nextNumber || 1;
    this.currentStep = data.currentStep || 1;
    this.maxStep = data.maxStep || 1;
    this.zoneShape = data.zoneShape || 'circle';
    this.textSize = data.textSize || 15;
    this._resize();
    this._recalcSteps();
    this.redraw();
    this.onChange();
  };

  Board.prototype.exportPNG = function () {
    this.stepFilter = null;
    this.redraw();
    return this.canvas.toDataURL('image/png');
  };

  // ---------- Templates ----------
  function applyFormation(board,key){
    board.clear();board.setPitch('vertical');const w=board.canvas.width,h=board.canvas.height;
    const d={
      '4-3-3':[[.5,.88],[.16,.72],[.38,.75],[.62,.75],[.84,.72],[.25,.53],[.5,.56],[.75,.53],[.2,.28],[.5,.22],[.8,.28]],
      '4-4-2':[[.5,.88],[.16,.72],[.38,.75],[.62,.75],[.84,.72],[.16,.52],[.38,.55],[.62,.55],[.84,.52],[.35,.27],[.65,.27]],
      '3-5-2':[[.5,.88],[.25,.75],[.5,.78],[.75,.75],[.1,.55],[.3,.52],[.5,.58],[.7,.52],[.9,.55],[.36,.28],[.64,.28]],
      '4-2-3-1':[[.5,.88],[.16,.72],[.38,.75],[.62,.75],[.84,.72],[.34,.57],[.66,.57],[.22,.35],[.5,.32],[.78,.35],[.5,.19]],
      '4-1-4-1':[[.5,.88],[.16,.72],[.38,.75],[.62,.75],[.84,.72],[.5,.61],[.16,.47],[.38,.5],[.62,.5],[.84,.47],[.5,.24]],
      '4-3-1-2':[[.5,.88],[.16,.72],[.38,.75],[.62,.75],[.84,.72],[.28,.54],[.5,.57],[.72,.54],[.5,.38],[.36,.25],[.64,.25]],
      '4-5-1':[[.5,.88],[.16,.72],[.38,.75],[.62,.75],[.84,.72],[.1,.5],[.3,.53],[.5,.55],[.7,.53],[.9,.5],[.5,.25]],
      '5-3-2':[[.5,.88],[.1,.73],[.3,.76],[.5,.78],[.7,.76],[.9,.73],[.28,.53],[.5,.57],[.72,.53],[.38,.28],[.62,.28]],
      '5-4-1':[[.5,.88],[.1,.73],[.3,.76],[.5,.78],[.7,.76],[.9,.73],[.15,.51],[.38,.54],[.62,.54],[.85,.51],[.5,.25]],
      '3-4-3':[[.5,.88],[.25,.76],[.5,.78],[.75,.76],[.15,.54],[.38,.56],[.62,.56],[.85,.54],[.2,.29],[.5,.23],[.8,.29]],
      '3-4-2-1':[[.5,.88],[.25,.76],[.5,.78],[.75,.76],[.14,.55],[.38,.57],[.62,.57],[.86,.55],[.36,.36],[.64,.36],[.5,.2]],
      '4-2-2-2':[[.5,.88],[.16,.72],[.38,.75],[.62,.75],[.84,.72],[.34,.56],[.66,.56],[.34,.36],[.66,.36],[.38,.23],[.62,.23]],
      '4-4-1-1':[[.5,.88],[.16,.72],[.38,.75],[.62,.75],[.84,.72],[.16,.51],[.38,.54],[.62,.54],[.84,.51],[.5,.34],[.5,.2]],
      '5-2-3':[[.5,.88],[.1,.73],[.3,.76],[.5,.78],[.7,.76],[.9,.73],[.38,.56],[.62,.56],[.2,.28],[.5,.23],[.8,.28]],
      '3-2-5':[[.5,.88],[.25,.76],[.5,.78],[.75,.76],[.36,.59],[.64,.59],[.08,.3],[.28,.27],[.5,.23],[.72,.27],[.92,.3]]};
    (d[key]||d['4-3-3']).forEach((p,i)=>board.elements.push({id:uid(),type:'token',team:'own',x:p[0]*w,y:p[1]*h,number:i+1,name:'',position:'',step:1}));
    board.nextNumber=12;board._recalcSteps();board.redraw();board.onChange();
  }

  function template433(board) {
    board.clear();
    board.setPitch('vertical');
    const w = board.canvas.width, h = board.canvas.height;
    const pts = [
      [0.5, 0.88], // GK
      [0.18, 0.72], [0.38, 0.75], [0.62, 0.75], [0.82, 0.72], // DEF
      [0.28, 0.52], [0.5, 0.55], [0.72, 0.52], // MID
      [0.2, 0.28], [0.5, 0.22], [0.8, 0.28] // ATT
    ];
    pts.forEach((p, i) => {
      board.elements.push({
        id: uid(), type: 'token', team: 'own',
        x: p[0] * w, y: p[1] * h, number: i + 1, step: 1
      });
    });
    board.nextNumber = 12;
    board._recalcSteps();
    board.redraw();
    board.onChange();
  }

  function template442(board) {
    board.clear();
    board.setPitch('vertical');
    const w = board.canvas.width, h = board.canvas.height;
    const pts = [
      [0.5, 0.88],
      [0.18, 0.72], [0.38, 0.75], [0.62, 0.75], [0.82, 0.72],
      [0.22, 0.5], [0.4, 0.52], [0.6, 0.52], [0.78, 0.5],
      [0.35, 0.25], [0.65, 0.25]
    ];
    pts.forEach((p, i) => {
      board.elements.push({
        id: uid(), type: 'token', team: 'own',
        x: p[0] * w, y: p[1] * h, number: i + 1, step: 1
      });
    });
    board.nextNumber = 12;
    board._recalcSteps();
    board.redraw();
    board.onChange();
  }

  function template352(board) {
    board.clear();
    board.setPitch('vertical');
    const w = board.canvas.width, h = board.canvas.height;
    const pts = [
      [0.5, 0.88],
      [0.28, 0.75], [0.5, 0.78], [0.72, 0.75],
      [0.12, 0.55], [0.35, 0.52], [0.5, 0.58], [0.65, 0.52], [0.88, 0.55],
      [0.38, 0.28], [0.62, 0.28]
    ];
    pts.forEach((p, i) => {
      board.elements.push({
        id: uid(), type: 'token', team: 'own',
        x: p[0] * w, y: p[1] * h, number: i + 1, step: 1
      });
    });
    board.nextNumber = 12;
    board._recalcSteps();
    board.redraw();
    board.onChange();
  }

  function templatePressAlto(board) {
    template433(board);
    const w = board.canvas.width, h = board.canvas.height;
    // pressure zone high
    board.elements.push({
      id: uid(), type: 'zone', zoneType: 'pressure',
      x: w * 0.5, y: h * 0.22, r: w * 0.32, step: 1
    });
    // numbered press arrows
    const arrows = [
      [0.2, 0.28, 0.25, 0.18],
      [0.5, 0.22, 0.5, 0.12],
      [0.8, 0.28, 0.75, 0.18]
    ];
    arrows.forEach((a, i) => {
      board.elements.push({
        id: uid(), type: 'arrow', style: 'numbered', width: 3,
        x1: a[0] * w, y1: a[1] * h, x2: a[2] * w, y2: a[3] * h,
        step: 2, seq: i + 1
      });
    });
    board.maxStep = 2;
    board.currentStep = 2;
    board.redraw();
    board.onChange();
  }

  function templateSalidaBalon(board) {
    template433(board);
    const w = board.canvas.width, h = board.canvas.height;
    // free space mid
    board.elements.push({
      id: uid(), type: 'zone', zoneType: 'free',
      x: w * 0.5, y: h * 0.45, r: w * 0.18, step: 1
    });
    // build-up arrows numbered
    const arrows = [
      [0.5, 0.88, 0.38, 0.75],
      [0.38, 0.75, 0.28, 0.52],
      [0.28, 0.52, 0.2, 0.28]
    ];
    arrows.forEach((a, i) => {
      board.elements.push({
        id: uid(), type: 'arrow', style: 'numbered', width: 2.5,
        x1: a[0] * w, y1: a[1] * h, x2: a[2] * w, y2: a[3] * h,
        step: i + 1, seq: i + 1
      });
    });
    // off-ball dashed
    board.elements.push({
      id: uid(), type: 'arrow', style: 'dashed', width: 2,
      x1: w * 0.5, y1: h * 0.22, x2: w * 0.35, y2: h * 0.3,
      step: 2
    });
    board.maxStep = 3;
    board.currentStep = 1;
    board.redraw();
    board.onChange();
  }


  function templateBloqueBajo(board) {
    board.clear(); board.setPitch('vertical');
    const w = board.canvas.width, h = board.canvas.height;
    const pts = [[.5,.88],[.2,.72],[.38,.76],[.62,.76],[.8,.72],[.25,.58],[.5,.6],[.75,.58],[.3,.42],[.7,.42],[.5,.28]];
    pts.forEach((p,i)=>board.elements.push({id:uid(),type:'token',team:'own',x:p[0]*w,y:p[1]*h,number:i+1,step:1}));
    board.nextNumber=12;
    board.elements.push({id:uid(),type:'zone',shape:'rect',zoneType:'danger',x1:w*.12,y1:h*.45,x2:w*.88,y2:h*.82,step:1});
    board._recalcSteps(); board.redraw(); board.onChange();
  }

  function templatePresionTrasPerdida(board) {
    template433(board);
    const w=board.canvas.width,h=board.canvas.height;
    board.elements.push({id:uid(),type:'zone',shape:'circle',zoneType:'pressure',x:w*.5,y:h*.34,r:w*.25,step:2});
    [[.3,.45,.18,.35],[.5,.4,.5,.28],[.7,.45,.82,.35]].forEach((a,i)=>board.elements.push({id:uid(),type:'arrow',style:'numbered',width:3,x1:a[0]*w,y1:a[1]*h,x2:a[2]*w,y2:a[3]*h,step:2,seq:i+1}));
    board.maxStep=2; board.currentStep=1; board.redraw(); board.onChange();
  }

  function templateAtaqueBanda(board) {
    template433(board);
    const w=board.canvas.width,h=board.canvas.height;
    board.elements.push({id:uid(),type:'zone',shape:'rect',zoneType:'free',x1:w*.06,y1:h*.18,x2:w*.3,y2:h*.72,step:1});
    board.elements.push({id:uid(),type:'arrow',style:'numbered',width:2.5,x1:w*.2,y1:h*.72,x2:w*.1,y2:h*.28,step:2,seq:1});
    board.elements.push({id:uid(),type:'arrow',style:'dashed',width:2,x1:w*.5,y1:h*.55,x2:w*.24,y2:h*.36,step:2});
    board.maxStep=2; board.currentStep=1; board.redraw(); board.onChange();
  }

  const TEMPLATES={};
  ['4-3-3','4-4-2','3-5-2','4-2-3-1','4-1-4-1','4-3-1-2','4-5-1','5-3-2','5-4-1','3-4-3','3-4-2-1','4-2-2-2','4-4-1-1','5-2-3','3-2-5'].forEach(k=>TEMPLATES[k]=b=>applyFormation(b,k));
  TEMPLATES['press-alto']=templatePressAlto;TEMPLATES['salida-balon']=templateSalidaBalon;TEMPLATES['bloque-bajo']=templateBloqueBajo;TEMPLATES['presion-perdida']=templatePresionTrasPerdida;TEMPLATES['ataque-banda']=templateAtaqueBanda;
  function situation(board,key){
    const base={ 'salida-balon':'salida-balon','ataque-banda':'ataque-banda','bloque-bajo':'bloque-bajo','press-alto':'press-alto','presion-perdida':'presion-perdida' };
    if(base[key]&&TEMPLATES[base[key]])TEMPLATES[base[key]](board);else applyFormation(board, key==='ataque-bloque-bajo'||key==='ultimo-tercio'?'4-2-3-1':key==='bloque-medio'||key==='defensa-centros'?'4-4-2':key==='defensa-area'||key==='corner-defensivo'?'5-4-1':'4-3-3');
    const w=board.canvas.width,h=board.canvas.height,add=o=>board.elements.push(Object.assign({id:uid(),step:1},o));
    if(['cambio-orientacion'].includes(key)){add({type:'arrow',style:'solid',width:3,x1:w*.22,y1:h*.5,x2:w*.78,y2:h*.28});add({type:'zone',shape:'rect',zoneType:'free',x1:w*.7,y1:h*.18,x2:w*.94,y2:h*.62});}
    else if(['contraataque','tras-recuperacion'].includes(key)){add({type:'arrow',style:'numbered',width:3,x1:w*.45,y1:h*.7,x2:w*.8,y2:h*.25,seq:1,step:2});}
    else if(['ultimo-tercio','ataque-bloque-bajo'].includes(key)){add({type:'zone',shape:'rect',zoneType:'danger',x1:w*.2,y1:h*.08,x2:w*.8,y2:h*.3});}
    else if(['bloque-medio','tras-perdida'].includes(key)){add({type:'zone',shape:'rect',zoneType:'pressure',x1:w*.12,y1:h*.38,x2:w*.88,y2:h*.62});add({type:'line',style:'pressure',width:2.5,x1:w*.12,y1:h*.5,x2:w*.88,y2:h*.5});}
    else if(['defensa-centros','defensa-area'].includes(key)){add({type:'line',style:'defensive',width:3,x1:w*.18,y1:h*.42,x2:w*.82,y2:h*.42});add({type:'zone',shape:'rect',zoneType:'danger',x1:w*.18,y1:h*.1,x2:w*.82,y2:h*.36});}
    else if(['corner-ofensivo','corner-defensivo','falta-lateral','falta-frontal','saque-banda'].includes(key)){add({type:'zone',shape:'rect',zoneType:'danger',x1:w*.05,y1:h*.08,x2:w*.42,y2:h*.32});add({type:'arrow',style:'solid',width:2.5,x1:w*.08,y1:h*.15,x2:w*.55,y2:h*.25});}
    board._recalcSteps();board.redraw();board.onChange();
  }
  window.PizarraSituations=situation;

  window.PizarraBoard = Board;
  window.PizarraTemplates = TEMPLATES;
})(window);

// ---------- UI bootstrap ----------
document.addEventListener('DOMContentLoaded', async () => {
  // Auth gate
  if (typeof supabaseClient !== 'undefined') {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) {
      window.location.href = 'index.html';
      return;
    }
  }
  document.querySelectorAll('.logout-trigger').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });
  });

  const canvas = document.getElementById('pizarra-canvas');
  if (!canvas) return;

  const stepLabel = document.getElementById('pizarra-step-label');
  const msg = document.getElementById('pizarra-msg');

  const board = new PizarraBoard(canvas, {
    onChange() {
      if (stepLabel) {
        stepLabel.textContent = `${board.currentStep} / ${board.maxStep}`;
      }
    }
  });
  window._pizarra = board;

  // Tool buttons
  document.querySelectorAll('[data-pz-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-pz-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      board.setTool(btn.dataset.pzTool);
      const panel = document.getElementById('pz-suboptions');
      if (panel) {
        panel.querySelectorAll('.pz-sub').forEach(s => s.hidden = true);
        const sub = panel.querySelector('[data-for="' + btn.dataset.pzTool + '"]');
        if (sub) sub.hidden = false;
      }
    });
  });

  document.querySelectorAll('[data-pz-pitch]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-pz-pitch]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      board.setPitch(btn.dataset.pzPitch);
    });
  });

  document.querySelectorAll('[data-arrow-style]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-arrow-style]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      board.arrowStyle = btn.dataset.arrowStyle;
    });
  });

  document.querySelectorAll('[data-arrow-width]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-arrow-width]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      board.arrowWidth = parseFloat(btn.dataset.arrowWidth);
    });
  });

  document.querySelectorAll('[data-zone-shape]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-zone-shape]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); board.zoneShape = btn.dataset.zoneShape;
    });
  });
  document.querySelectorAll('[data-text-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-text-size]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); board.textSize = parseInt(btn.dataset.textSize, 10);
    });
  });
  document.querySelectorAll('[data-pass-style]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-pass-style]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); board.passStyle = btn.dataset.passStyle;
    });
  });

  document.querySelectorAll('[data-zone-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-zone-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      board.zoneType = btn.dataset.zoneType;
    });
  });

  document.querySelectorAll('[data-line-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-line-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      board.lineType = btn.dataset.lineType;
    });
  });

  document.querySelectorAll('[data-token-team]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-token-team]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      board.tokenTeam = btn.dataset.tokenTeam;
    });
  });

  // Steps
  const btnPrev = document.getElementById('pz-step-prev');
  const btnNext = document.getElementById('pz-step-next');
  if (btnPrev) btnPrev.addEventListener('click', () => {
    board.setStep(board.currentStep - 1);
    board.onChange();
  });
  if (btnNext) btnNext.addEventListener('click', () => {
    board.setStep(board.currentStep + 1);
    board.onChange();
  });

  document.getElementById('pz-play')?.addEventListener('click', () => {
    if (board.playing) {
      board.stopPlay();
      document.getElementById('pz-play').textContent = '▶';
    } else {
      document.getElementById('pz-play').textContent = '⏹';
      board.play((step, max) => {
        if (stepLabel) stepLabel.textContent = `${step} / ${max}`;
        if (step >= max) document.getElementById('pz-play').textContent = '▶';
      });
    }
  });

  document.getElementById('pz-undo')?.addEventListener('click', () => board.undo());
  document.getElementById('pz-redo')?.addEventListener('click', () => board.redo());
  document.getElementById('pz-delete-selected')?.addEventListener('click', () => board.deleteSelected());
  document.getElementById('pz-duplicate-selected')?.addEventListener('click', () => board.duplicateSelected());
  document.getElementById('pz-clear')?.addEventListener('click', () => {
    if (confirm(t('pz.confirmClear') || '¿Borrar toda la pizarra?')) board.clear();
  });

  // Templates
  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fn = PizarraTemplates[btn.dataset.template];
      if (fn) fn(board);
    });
  });

  const playerEditor=document.getElementById('pz-player-editor'), playerName=document.getElementById('pz-player-name'), playerNumber=document.getElementById('pz-player-number'), playerPosition=document.getElementById('pz-player-position');
  let editingPlayerId=null;
  window.showPizarraPlayerEditor=function(el){editingPlayerId=el.id;if(playerEditor)playerEditor.hidden=false;if(playerName)playerName.value=el.name||'';if(playerNumber)playerNumber.value=el.number??'';if(playerPosition)playerPosition.value=el.position||'';};
  document.getElementById('pz-player-save')?.addEventListener('click',()=>{const el=board.elements.find(x=>x.id===editingPlayerId);if(!el)return;board.pushHistory();el.name=(playerName?.value||'').trim();el.number=Math.max(1,Math.min(99,Number(playerNumber?.value||el.number||1)));el.position=(playerPosition?.value||'').trim();board.redraw();board.onChange();});
  document.querySelectorAll('[data-situation]').forEach(btn=>btn.addEventListener('click',()=>window.PizarraSituations?.(board,btn.dataset.situation)));

  // Export PNG
  document.getElementById('pz-export-png')?.addEventListener('click', () => {
    const url = board.exportPNG();
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lingscout-pizarra.png';
    a.click();
  });

  // Save pattern
  document.getElementById('pz-save')?.addEventListener('click', async () => {
    const nombre = (document.getElementById('pz-nombre')?.value || '').trim();
    if (!nombre) {
      if (msg) { msg.textContent = t('pz.nombreRequerido') || 'Pon un nombre al patrón'; msg.className = 'form-message error'; }
      return;
    }
    const payload = {
      nombre,
      datos: board.toJSON(),
      updated_at: new Date().toISOString()
    };
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error('No auth');
      payload.usuario_id = user.id;
      const { error } = await supabaseClient.from('patrones_tacticos').upsert(payload, { onConflict: 'usuario_id,nombre' });
      if (error) throw error;
      if (msg) { msg.textContent = t('pz.guardado') || 'Patrón guardado'; msg.className = 'form-message success'; }
      cargarPatrones();
    } catch (err) {
      // fallback localStorage
      const key = 'lingscout-patrones';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const idx = list.findIndex(p => p.nombre === nombre);
      const item = { nombre, datos: board.toJSON(), updated_at: payload.updated_at };
      if (idx >= 0) list[idx] = item; else list.push(item);
      localStorage.setItem(key, JSON.stringify(list));
      if (msg) { msg.textContent = (t('pz.guardadoLocal') || 'Guardado en este dispositivo') + (err.message ? ' (' + err.message + ')' : ''); msg.className = 'form-message success'; }
      cargarPatrones();
    }
  });

  async function cargarPatrones() {
    const listEl = document.getElementById('pz-patrones-list');
    if (!listEl) return;
    let items = [];
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data } = await supabaseClient.from('patrones_tacticos').select('nombre, datos, updated_at').eq('usuario_id', user.id).order('updated_at', { ascending: false });
        if (data) items = data;
      }
    } catch (_) {}
    if (!items.length) {
      items = JSON.parse(localStorage.getItem('lingscout-patrones') || '[]');
    }
    listEl.innerHTML = items.length ? items.map(p =>
      `<button type="button" class="tool-btn pz-patron-btn" data-nombre="${escaparHtml(p.nombre)}">${escaparHtml(p.nombre)}</button>`
    ).join('') : `<p class="detail-empty">${t('pz.sinPatrones') || 'Sin patrones guardados'}</p>`;
    listEl.querySelectorAll('.pz-patron-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = items.find(x => x.nombre === btn.dataset.nombre);
        if (p) {
          board.loadJSON(typeof p.datos === 'string' ? JSON.parse(p.datos) : p.datos);
          const nom = document.getElementById('pz-nombre');
          if (nom) nom.value = p.nombre;
        }
      });
    });
  }

  function escaparHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  cargarPatrones();
  board.onChange();
  // Asegurar que el campo se pinta tras el layout
  requestAnimationFrame(() => { board._resize(); board.redraw(); });
  setTimeout(() => { board._resize(); board.redraw(); }, 50);
});
