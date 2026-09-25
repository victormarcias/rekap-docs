const contentEl = document.getElementById('rekap-content');
const contentInnerEl = document.getElementById('rekap-content-inner');
const scrollTopEl = document.getElementById('rekap-scroll-top');

let currentPath = null;
// `BASE`, `DEFAULT_PATH`, `titleFromName()`, `setActiveSidebarLink()`,
// `closeSidebarOnMobile()` live in filetree.js (loaded before this file).
// `topics`, `currentLang`, `baseKey()`, `resolveLangPath()` live in
// language.js (also loaded before this file).

if (window.markedGfmHeadingId) {
  marked.use(markedGfmHeadingId.gfmHeadingId());
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

const SCROLL_TOP_THRESHOLD = 400;
const SCROLL_TOP_BUTTON_SIZE = 42;
const SCROLL_TOP_GAP = 16;

// .markdown-body is a 3-column grid (gutter / 820px text column / gutter),
// centered and re-centering with viewport width — so "just right of the
// text" has to be computed from its actual box, not a fixed CSS offset.
function positionScrollTop() {
  const rect = contentInnerEl.getBoundingClientRect();
  const colWidth = Math.min(820, rect.width);
  const columnRight = rect.left + rect.width / 2 + colWidth / 2;
  // Clamp against contentEl's own scrollable box, not window.innerWidth —
  // Windows reserves ~17px of opaque scrollbar that innerWidth still counts
  // as page width, so a window.innerWidth-based clamp let the button land
  // underneath it (invisible there; macOS's overlay scrollbar hid the bug).
  const contentRect = contentEl.getBoundingClientRect();
  const safeRight = contentRect.left + contentEl.clientWidth;
  const maxLeft = safeRight - SCROLL_TOP_BUTTON_SIZE - 8;
  scrollTopEl.style.left = `${Math.min(columnRight + SCROLL_TOP_GAP, maxLeft)}px`;
}

contentEl.addEventListener('scroll', () => {
  scrollTopEl.classList.toggle('is-visible', contentEl.scrollTop > SCROLL_TOP_THRESHOLD);
});
window.addEventListener('resize', positionScrollTop);
positionScrollTop();

scrollTopEl.addEventListener('click', () => {
  contentEl.scrollTo({ top: 0, behavior: 'smooth' });
});

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
