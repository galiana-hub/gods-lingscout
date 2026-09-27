// Herramienta de dibujo táctico reutilizable.
// Uso: const tool = DrawingTool.init('id-del-canvas', '.selector-toolbar');
(function (window) {
  function init(canvasId, toolbarSelector) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const toolbar = document.querySelector(toolbarSelector);

    let pitchType = 'vertical';
    let mode = 'draw';
    let strokes = [];
    let currentStroke = null;
    let tokens = [];
    let draggingToken = null;
    let legacyImage = null;
    let tokenIdCounter = 1;

    const sizes = {
      vertical: { w: 300, h: 450 },
      half: { w: 300, h: 225 },
      horizontal: { w: 450, h: 300 }
    };

    function setCanvasSize() {
      const s = sizes[pitchType];
      canvas.width = s.w;
      canvas.height = s.h;
    }
    setCanvasSize();

    function drawPitchBackground() {
      const w = canvas.width, h = canvas.height;
      const stripes = 8;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#3E8E4F' : '#458F55';
        if (pitchType === 'horizontal') {
          ctx.fillRect(i * (w / stripes), 0, w / stripes, h);
        } else {
          ctx.fillRect(0, i * (h / stripes), w, h / stripes);
        }
      }
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      if (pitchType === 'vertical') {
        ctx.beginPath(); ctx.moveTo(4, h / 2); ctx.lineTo(w - 4, h / 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(w / 2, h / 2, 45, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeRect(w / 2 - 80, 4, 160, 60);
        ctx.strokeRect(w / 2 - 80, h - 64, 160, 60);
      } else if (pitchType === 'horizontal') {
        ctx.beginPath(); ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4); ctx.stroke();
        ctx.beginPath(); ctx.arc(w / 2, h / 2, 45, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeRect(4, h / 2 - 80, 60, 160);
        ctx.strokeRect(w - 64, h / 2 - 80, 60, 160);
      } else if (pitchType === 'half') {
        ctx.strokeRect(w / 2 - 110, -20, 220, 160);
        ctx.strokeRect(w / 2 - 50, -20, 100, 70);
        ctx.beginPath(); ctx.arc(w / 2, 140, 45, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
    }

    function redraw() {
      if (legacyImage) {
        ctx.drawImage(legacyImage, 0, 0, canvas.width, canvas.height);
      } else {
        drawPitchBackground();
      }

      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      strokes.forEach(stroke => {
        if (stroke.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        stroke.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      });

      tokens.forEach(t => {
        if (t.type === 'own') {
          ctx.beginPath(); ctx.arc(t.x, t.y, 10, 0, 2 * Math.PI);
          ctx.fillStyle = '#111111'; ctx.fill();
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
        } else if (t.type === 'rival') {
          ctx.beginPath(); ctx.arc(t.x, t.y, 10, 0, 2 * Math.PI);
          ctx.fillStyle = '#FFFFFF'; ctx.fill();
          ctx.strokeStyle = '#111111'; ctx.lineWidth = 2; ctx.stroke();
        } else if (t.type === 'ball') {
          ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#FFFFFF'; ctx.fill();
          ctx.strokeStyle = '#111111'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      });
    }

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    function findTokenNear(pos) {
      return tokens.find(t => Math.hypot(t.x - pos.x, t.y - pos.y) < 14);
    }

    function onPointerDown(e) {
      e.preventDefault();
      const pos = getPos(e);
      if (mode === 'draw') {
        currentStroke = [pos];
        strokes.push(currentStroke);
      } else if (mode === 'erase') {
        const hit = findTokenNear(pos);
        if (hit) { tokens = tokens.filter(t => t !== hit); redraw(); }
      } else {
        const hit = findTokenNear(pos);
        if (hit) {
          draggingToken = hit;
        } else {
          const nuevo = { id: tokenIdCounter++, type: mode, x: pos.x, y: pos.y };
          tokens.push(nuevo);
          draggingToken = nuevo;
        }
        redraw();
      }
    }

    function onPointerMove(e) {
      if (mode === 'draw' && currentStroke) {
        e.preventDefault();
        currentStroke.push(getPos(e));
        redraw();
      } else if (draggingToken) {
        e.preventDefault();
        const pos = getPos(e);
        draggingToken.x = pos.x;
        draggingToken.y = pos.y;
        redraw();
      }
    }

    function onPointerUp() {
      currentStroke = null;
      draggingToken = null;
    }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', onPointerMove, { passive: false });
    canvas.addEventListener('touchend', onPointerUp);

    toolbar.querySelectorAll('.perspective-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('.perspective-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        pitchType = btn.dataset.perspective;
        strokes = []; tokens = []; legacyImage = null;
        setCanvasSize();
        redraw();
      });
    });

    toolbar.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.mode;
      });
    });

    redraw();

    return {
      clear() { strokes = []; tokens = []; legacyImage = null; redraw(); },
      isEmpty() { return strokes.length === 0 && tokens.length === 0 && !legacyImage; },
      getDataURL() {
        return (strokes.length === 0 && tokens.length === 0 && !legacyImage) ? null : canvas.toDataURL('image/png');
      },
      loadImage(url) {
        const img = new Image();
        img.onload = () => { legacyImage = img; redraw(); };
        img.src = url;
      }
    };
  }

  window.DrawingTool = { init };
})(window);
