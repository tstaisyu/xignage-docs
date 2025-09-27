(function () {
  // 1) 多言語・多形式の日時パターン
  const DATE_PATTERNS = [
    /\b20\d{2}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?)?\b/, // 2025-09-27 / ISO
    /\b20\d{2}\/\d{1,2}\/\d{1,2}\b/,                                                   // 2025/9/27
    /20\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/,                                      // 2025年9月27日
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+20\d{2}\b/       // Sep 27, 2025
  ];

  function matchDate(text) {
    if (!text) return null;
    for (const re of DATE_PATTERNS) {
      const m = text.match(re);
      if (m) return m[0];
    }
    return null;
  }

  function findDateTextRobust() {
    // A) time / datetime / title 属性を優先（下部メタはたいていこれを持つ）
    const candidates = Array.from(document.querySelectorAll('time, [datetime], [title]'));
    for (const el of candidates) {
      const attrs = [el.getAttribute('datetime'), el.getAttribute('title'), el.textContent];
      for (const val of attrs) {
        const got = matchDate((val || '').trim());
        if (got) {
          console.log('[last-updated-top] matched ATTR/TEXT on', el, '=>', got);
          return got;
        }
      }
    }

    // B) よくある領域のテキストを後ろから探索
    const areas = [
      '[data-md-component="source"]',
      '.md-content__inner',
      '.md-content__footer',
      'footer',
      'body'
    ];
    for (const sel of areas) {
      const root = document.querySelector(sel);
      if (!root) continue;
      const nodes = Array.from(root.querySelectorAll('*')).reverse();
      for (const n of nodes) {
        const got = matchDate((n.textContent || '').trim());
        if (got) {
          console.log('[last-updated-top] matched TEXT in', sel, 'node:', n, '=>', got);
          return got;
        }
      }
    }

    console.warn('[last-updated-top] no date text found in DOM');
    return null;
  }

  function inject() {
    const root = document.querySelector('.md-content__inner');
    const h1 = root && root.querySelector('h1');
    if (!root || !h1) return;

    // 既存の表示を除去
    const old = root.querySelector('.md-last-updated-top');
    if (old) old.remove();

    const dateText = findDateTextRobust();

    const p = document.createElement('p');
    p.className = 'md-typeset md-meta md-last-updated-top';
    p.textContent = dateText ? `最終更新: ${dateText}` : '最終更新: (date not found)';
    p.style.textAlign = 'right';
    h1.insertAdjacentElement('afterend', p);
  }

  if (window.document$) {
    document$.subscribe(inject);
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }
})();
