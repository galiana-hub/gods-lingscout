/**
 * LingScout — Pizarra táctica
 * Motor de dibujo táctico con secuencia, flechas tipadas, zonas y plantillas.
 */
(function (window) {
  'use strict';

  const SIZES = {
    vertical: { w: 360, h: 540 },
    half: { w: 360, h: 270 },
    horizontal: { w: 540, h: 360 }
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
    connection: { color: '#6A1B9A', width: 1.5, dash: [] }
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
    this.lineType = 'pass';
    this.tokenTeam = 'own';      // own | rival | ball
    this.nextNumber = 1;
    this.elements = [];
    this.history = [];
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
    if (this.history.length > 40) this.history.shift();
  };

  Board.prototype.undo = function () {
    if (!this.history.length) return;
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

  Board.prototype.findNear = function (p, r) {
    r = r || 14;
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (el.type === 'token' || el.type === 'zone') {
        if (Math.hypot(el.x - p.x, el.y - p.y) < (el.r || r)) return el;
      }
    }
    return null;
  };

  Board.prototype._onDown = function (e) {
    e.preventDefault();
    const p = this.pos(e);
    const tool = this.tool;

    if (tool === 'select' || tool === 'erase') {
      const hit = this.findNear(p, 16);
      if (tool === 'erase' && hit) {
        this.pushHistory();
        this.elements = this.elements.filter(x => x.id !== hit.id);
        this._recalcSteps();
        this.redraw();
        this.onChange();
        return;
      }
      if (hit && hit.type === 'token') {
        this.selectedId = hit.id;
        this.dragId = hit.id;
        this.dragOff = { x: p.x - hit.x, y: p.y - hit.y };
        this.redraw();
        return;
      }
      this.selectedId = null;
      this.redraw();
      return;
    }

    if (tool === 'token') {
      this.pushHistory();
      const el = {
        id: uid(),
        type: 'token',
        team: this.tokenTeam,
        x: p.x,
        y: p.y,
        number: this.tokenTeam === 'ball' ? null : this.nextNumber,
        step: this.currentStep
      };
      if (this.tokenTeam !== 'ball') this.nextNumber++;
      this.elements.push(el);
      this.selectedId = el.id;
      this.dragId = el.id;
      this.dragOff = { x: 0, y: 0 };
      this._recalcSteps();
      this.redraw();
      this.onChange();
      return;
    }

    if (tool === 'arrow' || tool === 'line') {
      this.draft = {
        kind: tool,
        style: tool === 'arrow' ? this.arrowStyle : this.lineType,
        width: this.arrowWidth,
        x1: p.x, y1: p.y,
        x2: p.x, y2: p.y,
        step: this.currentStep,
        seq: tool === 'arrow' && this.arrowStyle === 'numbered' ? this._nextSeq() : null
      };
      return;
    }

    if (tool === 'zone') {
      this.draft = {
        kind: 'zone',
        zoneType: this.zoneType,
        x: p.x, y: p.y,
        r: 8,
        step: this.currentStep
      };
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
        el.x = p.x - this.dragOff.x;
        el.y = p.y - this.dragOff.y;
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
      this.draft.r = Math.max(12, Math.hypot(p.x - this.draft.x, p.y - this.draft.y));
    }
    this.redraw();
  };

  Board.prototype._onUp = function () {
    if (this.dragId) {
      this.dragId = null;
      this.dragOff = null;
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
      if (d.r < 14) {
        this.redraw();
        return;
      }
      this.pushHistory();
      this.elements.push({
        id: uid(),
        type: 'zone',
        zoneType: d.zoneType,
        x: d.x, y: d.y,
        r: d.r,
        step: d.step
      });
    }
    this._recalcSteps();
    this.redraw();
    this.onChange();
  };

  // ---------- Drawing ----------
  Board.prototype.drawPitch = function () {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#3E8E4F' : '#458F55';
      if (this.pitchType === 'horizontal') ctx.fillRect(i * (w / stripes), 0, w / stripes, h);
      else ctx.fillRect(0, i * (h / stripes), w, h / stripes);
    }
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    if (this.pitchType === 'vertical') {
      ctx.beginPath(); ctx.moveTo(4, h / 2); ctx.lineTo(w - 4, h / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 50, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(w / 2 - 90, 4, 180, 70);
      ctx.strokeRect(w / 2 - 40, 4, 80, 28);
      ctx.strokeRect(w / 2 - 90, h - 74, 180, 70);
      ctx.strokeRect(w / 2 - 40, h - 32, 80, 28);
    } else if (this.pitchType === 'horizontal') {
      ctx.beginPath(); ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 50, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(4, h / 2 - 90, 70, 180);
      ctx.strokeRect(4, h / 2 - 40, 28, 80);
      ctx.strokeRect(w - 74, h / 2 - 90, 70, 180);
      ctx.strokeRect(w - 32, h / 2 - 40, 28, 80);
    } else {
      ctx.strokeRect(w / 2 - 120, -24, 240, 170);
      ctx.strokeRect(w / 2 - 55, -24, 110, 75);
      ctx.beginPath(); ctx.arc(w / 2, 150, 50, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
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
      ctx.beginPath();
      ctx.arc(el.x, el.y, el.r, 0, Math.PI * 2);
      ctx.fillStyle = ZONE_COLORS[el.zoneType] || ZONE_COLORS.pressure;
      ctx.fill();
      ctx.strokeStyle = (ZONE_COLORS[el.zoneType] || '').replace(/[\d.]+\)$/, '0.7)') || 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
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
        this.drawElement({
          type: 'zone',
          zoneType: this.draft.zoneType,
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
      maxStep: this.maxStep
    };
  };

  Board.prototype.loadJSON = function (data) {
    if (!data) return;
    this.pitchType = data.pitchType || 'vertical';
    this.elements = data.elements || [];
    this.nextNumber = data.nextNumber || 1;
    this.currentStep = data.currentStep || 1;
    this.maxStep = data.maxStep || 1;
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

  const TEMPLATES = {
    '4-3-3': template433,
    '4-4-2': template442,
    '3-5-2': template352,
    'press-alto': templatePressAlto,
    'salida-balon': templateSalidaBalon
  };

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
