// Language selection: which variant of each topic to load (EN `name.md` vs
// ES `name.es.md`), the popup menu that drives it, and persistence via
// cookie. Loaded before rekap.js, which reads `topics`/`currentLang` and
// calls `resolveLangPath()`/`baseKey()` from here.

const langMenuEl = document.getElementById('rekap-lang-menu');
const langButtonEl = document.getElementById('rekap-lang-button');
const langListEl = document.getElementById('rekap-lang-list');

const LANG_COOKIE = 'rekap_lang';

// Add an entry here (and a matching <li data-lang="…"> in index.html) to
// support another language — everything else reads from this list.
const LANGS = {
  en: { flag: '🇬🇧', code: 'EN' },
  es: { flag: '🇪🇸', code: 'ES' },
};

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value, days = 365) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${days * 86400}; path=/; SameSite=Lax`;
}

let topics = new Map(); // baseKey ('folder/file.md') -> { en: bool, es: bool } — filled by rekap.js's init()
let currentLang = getCookie(LANG_COOKIE) === 'es' ? 'es' : 'en';

// Every topic in the repo exists as `name.md` (EN, default) and/or
// `name.es.md` (ES). baseKey() is the topic's canonical id — always the
// EN-style path — so sidebar entries, the URL hash, and sidebar highlighting
// stay stable across a language switch instead of being one-file-per-language.
function baseKey(path) {
  return path.replace(/\.es\.md$/i, '.md');
}

function esVariant(base) {
  return base.replace(/\.md$/i, '.es.md');
}

function buildTopics(files) {
  const map = new Map();
  for (const f of files) {
    const key = baseKey(f);
    if (!map.has(key)) map.set(key, { en: false, es: false });
    const entry = map.get(key);
    if (/\.es\.md$/i.test(f)) entry.es = true;
    else entry.en = true;
  }
  return map;
}

// Which actual file to fetch for a topic, given the selected language —
// falls back to whichever language variant actually exists.
function resolveLangPath(base) {
  const variants = topics.get(base) || { en: true, es: false };
  if (currentLang === 'es' && variants.es) return esVariant(base);
  if (currentLang === 'en' && !variants.en && variants.es) return esVariant(base);
  return base;
}

function setLangUI(lang) {
  const info = LANGS[lang];
  if (info) {
    langButtonEl.querySelector('.rekap-lang-flag').textContent = info.flag;
    langButtonEl.querySelector('.rekap-lang-code').textContent = info.code;
  }
  langListEl.querySelectorAll('[data-lang]').forEach(li => {
    li.setAttribute('aria-selected', String(li.dataset.lang === lang));
  });
}

function openLangMenu() {
  langListEl.hidden = false;
  langButtonEl.setAttribute('aria-expanded', 'true');
}

function closeLangMenu() {
  langListEl.hidden = true;
  langButtonEl.setAttribute('aria-expanded', 'false');
}

async function setLang(lang) {
  closeLangMenu();
  if (lang === currentLang) return;
  currentLang = lang;
  setCookie(LANG_COOKIE, lang);
  setLangUI(lang);
  if (!currentPath) return;
  // Fade the old content out, swap it once it's invisible, fade the new
  // content back in — avoids a jarring instant flip when switching language.
  contentInnerEl.classList.add('rekap-fade');
  await new Promise(resolve => setTimeout(resolve, 160));
  await renderPage(currentPath);
  requestAnimationFrame(() => contentInnerEl.classList.remove('rekap-fade'));
}

langButtonEl.addEventListener('click', (e) => {
  e.stopPropagation();
  if (langListEl.hidden) openLangMenu(); else closeLangMenu();
});
langListEl.addEventListener('click', (e) => {
  const opt = e.target.closest('[data-lang]');
  if (opt) setLang(opt.dataset.lang);
});
document.addEventListener('click', (e) => {
  if (!langMenuEl.contains(e.target)) closeLangMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLangMenu();
});
setLangUI(currentLang);
