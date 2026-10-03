function actualizarIconoTema() {
  const esOscuro = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelectorAll('.theme-toggle-icon').forEach(el => {
    el.textContent = esOscuro ? '☀️' : '🌙';
  });
}

function toggleTheme() {
  const esOscuro = document.documentElement.getAttribute('data-theme') === 'dark';
  if (esOscuro) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('lingscout-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('lingscout-theme', 'dark');
  }
  actualizarIconoTema();
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarIconoTema();
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
});

/* ---------- Cuadros de texto: crecen solos según lo escrito ---------- */
(function () {
  function crecer(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    if (!el.offsetParent && el.offsetHeight === 0) return; // oculto: se recalcula cuando se muestre
    el.style.height = 'auto';
    const borde = el.offsetHeight - el.clientHeight;
    const alto = el.scrollHeight + borde;
    if (alto > 0) el.style.height = alto + 'px';
  }

  // Si el código de la app rellena el valor (al editar un análisis), también se ajusta
  const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  if (desc && desc.set) {
    Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (v) { desc.set.call(this, v); crecer(this); }
    });
  }

  const observador = ('ResizeObserver' in window)
    ? new ResizeObserver(entries => entries.forEach(e => crecer(e.target)))
    : null;

  function preparar(el) {
    if (el.dataset.autogrow) return;
    el.dataset.autogrow = '1';
    el.style.resize = 'none';
    el.style.overflow = 'hidden';
    el.addEventListener('input', () => crecer(el));
    if (observador) observador.observe(el);
    crecer(el);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('textarea').forEach(preparar);
    document.addEventListener('reset', () => {
      setTimeout(() => document.querySelectorAll('textarea').forEach(crecer), 0);
    }, true);
  });
  window.addEventListener('load', () => document.querySelectorAll('textarea').forEach(crecer));
})();
