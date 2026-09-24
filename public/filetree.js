// The file tree: fetching the repo's file list from GitHub, rendering it as
// a collapsible sidebar, search/filtering, active-link highlighting, and the
// mobile sidebar open/close. Loaded before rekap.js, which reads `BASE`,
// `DEFAULT_PATH`, `titleFromName()`, `setActiveSidebarLink()` and
// `closeSidebarOnMobile()` from here.

const OWNER = 'victormarcias';
const REPO = 'Rekap';
const BRANCH = 'translate-english';
const BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;
const TREE_API = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
const CACHE_KEY = 'rekap_tree_cache_v1';
const CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_PATH = 'README.md';

const sidebarEl = document.getElementById('rekap-sidebar');
const treeContainerEl = document.getElementById('rekap-tree-container');
const searchInput = document.getElementById('rekap-search');
const searchClearEl = document.getElementById('rekap-search-clear');
const sidebarToggle = document.getElementById('rekap-sidebar-toggle');
const sidebarBackdrop = document.getElementById('rekap-sidebar-backdrop');

let allFiles = []; // filled by rekap.js's init() via fetchTree()

const ACRONYMS = new Set([
  'acid', 'ai', 'api', 'aws', 'bdd', 'ci', 'cd', 'cdn', 'cli', 'cors', 'cap',
  'cpu', 'crud', 'css', 'csr', 'csrf', 'db', 'dns', 'dom', 'dry', 'fp', 'gc',
  'gcp', 'gdpr', 'gui', 'html', 'http', 'https', 'iam', 'io', 'jit', 'json',
  'jvm', 'jwt', 'kiss', 'llm', 'mcp', 'ml', 'mvc', 'mvp', 'oop', 'orm', 'os',
  'prd', 'pwa', 'rag', 'rdbms', 'rest', 'sdk', 'solid', 'spa', 'sql', 'sse',
  'ssr', 'ssrf', 'tcp', 'tdd', 'udp', 'url', 'uri', 'uuid', 'vm', 'vpc',
  'vps', 'xml', 'xss', 'yagni',
]);

// Terms whose correct casing isn't all-caps, so a plain toUpperCase() would
// get them wrong (e.g. "DDOS" instead of "DDoS") — checked before ACRONYMS.
const WORD_OVERRIDES = {
  ddos: 'DDoS',
  devops: 'DevOps',
  fastapi: 'FastAPI',
  graphql: 'GraphQL',
  javascript: 'JavaScript',
  n8n: 'n8n',
  nestjs: 'NestJS',
  nosql: 'NoSQL',
  oauth: 'OAuth',
  sargable: 'SARGable',
  typescript: 'TypeScript',
  websocket: 'WebSocket',
};

function titleFromName(name) {
  const base = name.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
  return base
    .split(' ')
    .map((word) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      if (WORD_OVERRIDES[lower]) return WORD_OVERRIDES[lower];
      if (ACRONYMS.has(lower)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

async function fetchTree() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS && Array.isArray(cached.files)) {
      return cached.files;
    }
  } catch (err) {
    // Ignore a corrupt/unavailable cache and fall through to a live fetch.
  }

  const res = await fetch(TREE_API);
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  const files = data.tree
    .filter(item => item.type === 'blob' && item.path.toLowerCase().endsWith('.md'))
    .map(item => item.path)
    .sort((a, b) => a.localeCompare(b));

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), files }));
  } catch (err) {
    // Storage can be full or disabled (private browsing) — caching is an optimization, not a requirement.
  }
  return files;
}

function buildTree(paths) {
  const root = { dirs: {}, files: [] };
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node.files.push({ name: part, path });
      } else {
        if (!node.dirs[part]) node.dirs[part] = { dirs: {}, files: [] };
        node = node.dirs[part];
      }
    });
  }
  return root;
}

function renderNode(node, dirPath) {
  const ul = document.createElement('ul');

  const dirNames = Object.keys(node.dirs).sort((a, b) => a.localeCompare(b));
  for (const dirName of dirNames) {
    const li = document.createElement('li');
    const details = document.createElement('details');
    details.dataset.dirPath = dirPath ? `${dirPath}/${dirName}` : dirName;
    const summary = document.createElement('summary');
    summary.textContent = titleFromName(dirName);
    details.appendChild(summary);
    details.appendChild(renderNode(node.dirs[dirName], details.dataset.dirPath));
    li.appendChild(details);
    ul.appendChild(li);
  }

  const files = node.files
    .slice()
    .sort((a, b) => {
      if (a.name.toLowerCase() === 'readme.md') return -1;
      if (b.name.toLowerCase() === 'readme.md') return 1;
      return a.name.localeCompare(b.name);
    });
  for (const file of files) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + file.path;
    const isReadme = file.name.toLowerCase() === 'readme.md';
    const isGlossary = file.name.toLowerCase() === 'glossary.md';
    a.textContent = isReadme ? 'Index' : isGlossary ? 'Glossary' : titleFromName(file.name);
    if (isReadme) a.classList.add('rekap-index-link');
    if (isGlossary) a.classList.add('rekap-glosario-link');
    a.dataset.path = file.path;
    li.appendChild(a);
    ul.appendChild(li);
  }

  return ul;
}

function renderSidebar(paths, { expandAll = false } = {}) {
  treeContainerEl.innerHTML = '';

  if (paths.length === 0) {
    treeContainerEl.innerHTML = '<div class="rekap-status">No matches.</div>';
    return;
  }

  const tree = buildTree(paths);
  const wrap = document.createElement('div');
  wrap.className = 'rekap-tree';
  wrap.appendChild(renderNode(tree, ''));
  treeContainerEl.appendChild(wrap);

  if (expandAll) {
    wrap.querySelectorAll('details').forEach(details => { details.open = true; });
  }
}

// Animated collapse/expand for the sidebar's folder <details> elements —
// native <details> has no transition for its own open/close, so this drives
// a height animation via the Web Animations API instead. State is per-element
// (WeakMap, so it's naturally dropped when renderSidebar rebuilds the tree).
const detailsAnimState = new WeakMap();
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function getDetailsAnimState(details) {
  let state = detailsAnimState.get(details);
  if (!state) {
    state = { animation: null, isClosing: false, isExpanding: false };
    detailsAnimState.set(details, state);
  }
  return state;
}

function animateDetailsHeight(details, summary, content, state, opening) {
  state.isExpanding = opening;
  state.isClosing = !opening;
  const startHeight = `${details.offsetHeight}px`;
  const endHeight = opening
    ? `${summary.offsetHeight + content.offsetHeight}px`
    : `${summary.offsetHeight}px`;
  if (state.animation) state.animation.cancel();
  state.animation = details.animate(
    { height: [startHeight, endHeight] },
    { duration: 180, easing: 'ease-out' }
  );
  state.animation.onfinish = () => {
    details.open = opening;
    state.animation = null;
    state.isClosing = false;
    state.isExpanding = false;
    details.style.height = '';
    details.style.overflow = '';
  };
  state.animation.oncancel = () => {
    state.isClosing = false;
    state.isExpanding = false;
  };
}

function toggleDetailsAnimated(details) {
  const summary = details.querySelector(':scope > summary');
  const content = details.querySelector(':scope > ul');
  if (!summary || !content) return;
  if (prefersReducedMotion) {
    details.open = !details.open;
    return;
  }
  const state = getDetailsAnimState(details);
  details.style.overflow = 'hidden';

  if (state.isClosing || !details.open) {
    // Pin the (closed) height first so the browser doesn't jump straight to
    // the full content height when `open` flips content back into layout.
    details.style.height = `${details.offsetHeight}px`;
    details.open = true;
    requestAnimationFrame(() => animateDetailsHeight(details, summary, content, state, true));
  } else if (state.isExpanding || details.open) {
    animateDetailsHeight(details, summary, content, state, false);
  }
}

function filterFiles(query) {
  const q = query.trim().toLowerCase();
  const keys = Array.from(topics.keys());
  if (!q) return keys;
  return keys.filter(path => path.toLowerCase().includes(q));
}

function applySearch() {
  const query = searchInput.value;
  searchClearEl.hidden = query === '';
  renderSidebar(filterFiles(query), { expandAll: query.trim() !== '' });
  if (currentPath) setActiveSidebarLink(currentPath);
}

function setActiveSidebarLink(path) {
  treeContainerEl.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));
  const link = treeContainerEl.querySelector(`a[data-path="${CSS.escape(path)}"]`);
  if (!link) return;
  link.classList.add('active');
  let details = link.closest('details');
  while (details) {
    details.open = true;
    details = details.parentElement ? details.parentElement.closest('details') : null;
  }
  link.scrollIntoView({ block: 'nearest' });
}

function closeSidebarOnMobile() {
  sidebarEl.classList.remove('is-open');
  sidebarToggle.setAttribute('aria-expanded', 'false');
}

sidebarToggle.addEventListener('click', () => {
  const isOpen = sidebarEl.classList.toggle('is-open');
  sidebarToggle.setAttribute('aria-expanded', String(isOpen));
});
sidebarBackdrop.addEventListener('click', closeSidebarOnMobile);
searchInput.addEventListener('input', applySearch);
searchClearEl.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  applySearch();
});

treeContainerEl.addEventListener('click', (e) => {
  const summary = e.target.closest('summary');
  if (!summary) return;
  const details = summary.parentElement;
  if (!details || details.tagName !== 'DETAILS') return;
  e.preventDefault();
  toggleDetailsAnimated(details);
});
