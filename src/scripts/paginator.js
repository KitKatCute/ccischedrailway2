'use strict';

/**
 * Pager — tiny shared pagination control (chairperson pages).
 *
 *   const pager = Pager.create(el, { pageSize: 8, noun: ['course', 'courses'], onPage: render });
 *   const page  = pager.set({ total: rows.length, page: currentPage });   // draws + returns clamped page
 *   rows.slice((page - 1) * pager.pageSize, page * pager.pageSize)
 *
 * Works for client-side lists (slice the array yourself) and for
 * server-paged lists (call set() with the server's total and page).
 */
const Pager = (() => {
  function pageList(page, pages) {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const out = [1];
    const start = Math.max(2, page - 1);
    const end   = Math.min(pages - 1, page + 1);
    if (start > 2) out.push('…');
    for (let i = start; i <= end; i++) out.push(i);
    if (end < pages - 1) out.push('…');
    out.push(pages);
    return out;
  }

  function create(el, { pageSize = 10, noun = ['item', 'items'], onPage } = {}) {
    if (!el) return null;
    el.classList.add('pager');
    let total = 0;
    let page  = 1;

    const pages = () => Math.max(1, Math.ceil(total / pageSize));
    const clamp = (n) => Math.min(Math.max(1, n), pages());

    function draw() {
      if (total === 0) { el.hidden = true; el.innerHTML = ''; return; }
      el.hidden = false;
      const from = (page - 1) * pageSize + 1;
      const to   = Math.min(page * pageSize, total);
      const n    = pages();
      const info = `Showing <strong>${from}–${to}</strong> of <strong>${total}</strong> ${total === 1 ? noun[0] : noun[1]}`;
      if (n <= 1) { el.innerHTML = `<span class="pager__info">${info}</span>`; return; }

      const nums = pageList(page, n).map(p => p === '…'
        ? '<span class="pager__gap">…</span>'
        : `<button type="button" class="pager__btn${p === page ? ' pager__btn--active' : ''}" data-page="${p}"` +
          `${p === page ? ' aria-current="page"' : ''} aria-label="Page ${p}">${p}</button>`).join('');

      el.innerHTML = `
        <span class="pager__info">${info}</span>
        <nav class="pager__nav" aria-label="Pagination">
          <button type="button" class="pager__btn pager__btn--step" data-page="prev" ${page <= 1 ? 'disabled' : ''}>‹ Prev</button>
          ${nums}
          <button type="button" class="pager__btn pager__btn--step" data-page="next" ${page >= n ? 'disabled' : ''}>Next ›</button>
        </nav>`;
    }

    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      const v = btn.dataset.page;
      const next = clamp(v === 'prev' ? page - 1 : v === 'next' ? page + 1 : Number(v));
      if (next === page) return;
      page = next;
      draw();
      if (onPage) onPage(page);
    });

    return {
      pageSize,
      get page() { return page; },
      set(opts = {}) {
        if (typeof opts.total === 'number') total = opts.total;
        if (typeof opts.page  === 'number') page  = opts.page;
        page = clamp(page);
        draw();
        return page;
      },
    };
  }

  return { create };
})();
