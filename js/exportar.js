// Exportar un análisis como documento legible (PDF desde el diálogo de impresión)
// Uso: exportarAnalisis(titulo, subtitulo, htmlDetalle)
function exportarAnalisis(titulo, subtitulo, htmlDetalle) {
  const caja = document.createElement('div');
  caja.innerHTML = htmlDetalle;
  caja.querySelectorAll('.detail-actions').forEach(el => el.remove());

  const css = new URL('css/style.css', location.href).href;
  const idioma = localStorage.getItem('lingscout-lang') || 'es';
  const rtl = ['ar', 'ary', 'fa', 'he'].includes(idioma) ? 'rtl' : 'ltr';
  const doc = `<!DOCTYPE html><html lang="${idioma}" dir="${rtl}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${String(titulo).replace(/</g, '&lt;')}</title>
<link rel="stylesheet" href="${css}">
<style>
  body { display:block; background:#fff; color:#111; padding:24px; max-width:760px; margin:0 auto; font-family:Inter,system-ui,sans-serif; }
  h1 { font-size:1.4rem; margin:0 0 4px; }
  .exp-sub { color:#666; margin:0 0 18px; font-size:.9rem; }
  .detail-drawing, .mini-pitch { max-width:100%; height:auto; }
  .mini-pitch { width:260px; }
  .exp-btn { position:fixed; top:12px; right:12px; padding:9px 14px; border:1px solid #111; border-radius:10px; background:#fff; font:inherit; cursor:pointer; }
  @media print { .exp-btn { display:none; } body { padding:0; } }
</style></head><body>
<button class="exp-btn" onclick="window.print()">PDF</button>
<h1>${String(titulo).replace(/</g, '&lt;')}</h1>
<p class="exp-sub">${String(subtitulo || '').replace(/</g, '&lt;')}</p>
${caja.innerHTML}
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.open(); w.document.write(doc); w.document.close();
  } else {
    // Si el navegador bloquea la ventana, se descarga el documento como archivo
    const blob = new Blob([doc], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = String(titulo).replace(/[^\w\-]+/g, '_').slice(0, 60) + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}
