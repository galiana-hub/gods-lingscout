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
