// Utilidades compartidas por la lista de informes y el editor
const INF_BUCKET = 'informes';
const INF_PRESETS = ['contexto', 'queSeVe', 'ofensiva', 'defensiva', 'transiciones', 'abp', 'jugador', 'conclusion'];
const INF_COLORES_MARCA = ['#E53935', '#FDD835', '#1E88E5', '#43A047', '#8E24AA'];

// 754 -> "12:34"; 3754 -> "1:02:34"
function infFormatoTiempo(seg) {
  const s = Math.max(0, Math.floor(Number(seg) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const dos = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${dos(m)}:${dos(r)}` : `${m}:${dos(r)}`;
}

// "12:34", "1:02:34", "754" -> segundos (null si no se entiende)
function infLeerTiempo(texto) {
  const t = String(texto || '').trim().replace(/[.,']/g, ':');
  if (!t) return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const partes = t.split(':').map(p => p.trim());
  if (partes.length > 3 || partes.some(p => !/^\d+$/.test(p))) return null;
  return partes.reduce((acc, p) => acc * 60 + parseInt(p, 10), 0);
}

// Solo se aceptan enlaces http/https
function infEnlaceValido(url) {
  try {
    const u = new URL(String(url || '').trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
  } catch (e) { return null; }
}

function infIdYoutube(url) {
  const u = infEnlaceValido(url);
  if (!u) return null;
  const m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function infYoutubeEn(id, seg) {
  return `https://www.youtube.com/watch?v=${id}&t=${Math.floor(seg || 0)}s`;
}

function infYoutubeEmbed(id, seg, autoplay) {
  return `https://www.youtube-nocookie.com/embed/${id}?start=${Math.floor(seg || 0)}${autoplay ? '&autoplay=1' : ''}&rel=0`;
}

// Enlaces temporales a los archivos privados (caché de 50 minutos)
const _infUrls = {};
async function infUrlFirmada(path) {
  if (!path) return null;
  const c = _infUrls[path];
  if (c && c.hasta > Date.now()) return c.url;
  const { data, error } = await supabaseClient.storage.from(INF_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  _infUrls[path] = { url: data.signedUrl, hasta: Date.now() + 50 * 60 * 1000 };
  return data.signedUrl;
}

// La tabla todavía no existe (falta ejecutar el SQL)
function infFaltaTabla(error) {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|Could not find the table/i.test(error.message || '');
}

function infTituloPreset(clave) { return t('inf.pre_' + clave); }

function infEtiquetaTipo(inf) {
  if (inf.tipo === 'captura') return t('inf.tipoCaptura');
  return inf.subtipo === 'jugada' ? `${t('inf.tipoVideo')} · ${t('inf.subJugada')}` : `${t('inf.tipoVideo')} · ${t('inf.subPartido')}`;
}
