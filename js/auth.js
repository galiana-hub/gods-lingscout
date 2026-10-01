// Cambio de pestañas (Iniciar sesión / Crear cuenta)
const tabBtns = document.querySelectorAll('.tab-btn');
const forms = document.querySelectorAll('.auth-form');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab + '-form').classList.add('active');
  });
});

// Si ya hay una sesión activa, saltar directo al dashboard
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    window.location.href = 'app.html';
  }
})();

// Registro de nueva cuenta
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const msg = document.getElementById('register-message');
  msg.textContent = '';
  msg.className = 'form-message';

  const { error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    msg.textContent = error.message;
    msg.classList.add('error');
  } else {
    msg.textContent = t('ui.cuentaCreada');
    msg.classList.add('success');
  }
});

// Inicio de sesión
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-message');
  msg.textContent = '';
  msg.className = 'form-message';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    msg.textContent = error.message;
    msg.classList.add('error');
  } else {
    window.location.href = 'app.html';
  }
});
