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
const contentEl = document.getElementById('rekap-content');
const contentInnerEl = document.getElementById('rekap-content-inner');
const sidebarToggle = document.getElementById('rekap-sidebar-toggle');
const sidebarBackdrop = document.getElementById('rekap-sidebar-backdrop');

let allFiles = [];
let currentPath = null;
// `topics`, `currentLang`, `baseKey()`, `resolveLangPath()` live in language.js
// (loaded before this file) — init() below fills `topics` in once the tree loads.

if (window.markedGfmHeadingId) {
  marked.use(markedGfmHeadingId.gfmHeadingId());
}

const ACRONYMS = new Set([
  'ai', 'api', 'aws', 'bdd', 'ci', 'cd', 'cdn', 'cli', 'cors', 'cap', 'crud',
  'css', 'csr', 'csrf', 'db', 'dns', 'dry', 'fp', 'gc', 'gcp', 'gui', 'html',
  'http', 'https', 'iam', 'io', 'jit', 'json', 'jvm', 'jwt', 'kiss', 'llm',
  'ml', 'mvc', 'mvp', 'nosql', 'oauth', 'oop', 'orm', 'os', 'pwa', 'rag',
  'rdbms', 'rest', 'sdk', 'solid', 'spa', 'sql', 'ssr', 'tcp', 'tdd', 'udp',
  'url', 'uri', 'uuid', 'vm', 'vpc', 'xml', 'xss', 'yagni',
]);

function titleFromName(name) {
  const base = name.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
  return base
    .split(' ')
    .map((word) => {
      if (!word) return word;
      if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function resolvePath(baseDir, relPath) {
  if (relPath.endsWith('/')) relPath += 'README.md';
  const parts = (baseDir ? baseDir.split('/') : []).concat(relPath.split('/'));
  const stack = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function rewritePaths(container, currentPath) {
  const currentDir = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/')) : '';

  container.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (/^([a-z]+:)?\/\//i.test(href) || href.startsWith('mailto:')) return;
    const [filePart, anchor] = href.split('#');
    if (!filePart) {
      // Same-page anchor (e.g. a glossary's A-Z jump list) — route it through
      // the current page's own path so it doesn't get treated as a file path.
      if (anchor) a.setAttribute('href', '#' + currentPath + '#' + anchor);
      return;
    }
    const resolved = baseKey(resolvePath(currentDir, filePart));
    a.setAttribute('href', '#' + resolved + (anchor ? '#' + anchor : ''));
  });

  container.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src');
    if (/^([a-z]+:)?\/\//i.test(src) || src.startsWith('data:')) return;
    img.setAttribute('src', BASE + resolvePath(currentDir, src));
  });
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

function filterFiles(query) {
  const q = query.trim().toLowerCase();
  const keys = Array.from(topics.keys());
  if (!q) return keys;
  return keys.filter(path => path.toLowerCase().includes(q));
}

function applySearch() {
  const query = searchInput.value;
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

async function loadPage(path) {
  const fetchPath = resolveLangPath(path);
  const res = await fetch(BASE + fetchPath);
  if (!res.ok) throw new Error(`404: ${fetchPath}`);
  const markdown = await res.text();
  if (window.markedGfmHeadingId) markedGfmHeadingId.resetHeadings();
  const html = marked.parse(markdown);
  const container = document.createElement('div');
  container.innerHTML = html;
  rewritePaths(container, path);
  return container;
}

async function renderPage(path) {
  currentPath = path;
  contentInnerEl.innerHTML = '<div class="rekap-status">Loading&hellip;</div>';
  try {
    const container = await loadPage(path);
    contentInnerEl.innerHTML = container.innerHTML;
    contentInnerEl.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    contentEl.scrollTop = 0;
    document.title = `${titleFromName(path.split('/').pop())} — Rekap`;
    setActiveSidebarLink(path);
  } catch (err) {
    contentInnerEl.innerHTML = `<div class="rekap-status rekap-error">Couldn't load <code>${path}</code>. ${err.message}</div>`;
  }
  closeSidebarOnMobile();
}

function currentPathAndAnchorFromHash() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [path, anchor] = hash.split('#');
  return { path: path || DEFAULT_PATH, anchor: anchor || null };
}

function scrollToAnchor(anchor) {
  if (!anchor) return;
  const target = contentInnerEl.querySelector(`#${CSS.escape(anchor)}, a[name="${CSS.escape(anchor)}"]`);
  if (target) target.scrollIntoView({ block: 'start' });
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

window.addEventListener('hashchange', () => {
  const { path, anchor } = currentPathAndAnchorFromHash();
  if (path === currentPath) {
    scrollToAnchor(anchor);
  } else {
    renderPage(path).then(() => scrollToAnchor(anchor));
  }
});

(async function init() {
  try {
    allFiles = await fetchTree();
    topics = buildTopics(allFiles);
    renderSidebar(Array.from(topics.keys()));
  } catch (err) {
    treeContainerEl.innerHTML = `<div class="rekap-status rekap-error">Couldn't load the file list. ${err.message}</div>`;
  }
  const { path, anchor } = currentPathAndAnchorFromHash();
  await renderPage(path);
  scrollToAnchor(anchor);
})();
