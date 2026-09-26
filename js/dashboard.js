// Proteger esta página: si no hay sesión, volver al login
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('user-email').textContent = data.session.user.email;
})();

// Cerrar sesión
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
});
