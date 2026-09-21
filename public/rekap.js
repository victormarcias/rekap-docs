const OWNER = 'victormarcias';
const REPO = 'Rekap';
const BRANCH = 'main';
const BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;
const TREE_API = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
const CACHE_KEY = 'rekap_tree_cache_v1';
const CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_PATH = 'README.md';

const sidebarEl = document.getElementById('rekap-sidebar');
const contentEl = document.getElementById('rekap-content');
const contentInnerEl = document.getElementById('rekap-content-inner');
const sidebarToggle = document.getElementById('rekap-sidebar-toggle');
const sidebarBackdrop = document.getElementById('rekap-sidebar-backdrop');

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
    .map((word, i) => {
      if (!word) return word;
      if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
      return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
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
    if (!filePart) return;
    const resolved = resolvePath(currentDir, filePart);
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
    a.textContent = isReadme ? 'Index' : titleFromName(file.name);
    if (isReadme) a.classList.add('rekap-index-link');
    a.dataset.path = file.path;
    li.appendChild(a);
    ul.appendChild(li);
  }

  return ul;
}

function renderSidebar(paths) {
  const tree = buildTree(paths);
  sidebarEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'rekap-tree';
  wrap.appendChild(renderNode(tree, ''));
  sidebarEl.appendChild(wrap);
}

function setActiveSidebarLink(path) {
  sidebarEl.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));
  const link = sidebarEl.querySelector(`a[data-path="${CSS.escape(path)}"]`);
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
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`404: ${path}`);
  const markdown = await res.text();
  const html = marked.parse(markdown);
  const container = document.createElement('div');
  container.innerHTML = html;
  rewritePaths(container, path);
  return container;
}

async function renderPage(path) {
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

function currentPathFromHash() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  return hash || DEFAULT_PATH;
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

window.addEventListener('hashchange', () => renderPage(currentPathFromHash()));

(async function init() {
  try {
    const files = await fetchTree();
    renderSidebar(files);
  } catch (err) {
    sidebarEl.innerHTML = `<div class="rekap-status rekap-error">Couldn't load the file list. ${err.message}</div>`;
  }
  renderPage(currentPathFromHash());
})();
