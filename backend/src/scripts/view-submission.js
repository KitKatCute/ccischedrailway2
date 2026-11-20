'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// ── Notification bell ──
const notifBtn = document.getElementById('notifBtn');
if (notifBtn) {
  notifBtn.addEventListener('click', () => {
    window.location.href = 'notifications.html';
  });
}

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const STORAGE_KEY    = 'ccisched_slots';
const FINALIZED_KEY  = 'ccisched_finalized';   // boolean flag

const TIME_SLOTS = [
  '7:30 - 9:00',
  '9:00 - 10:30',
  '10:30 - 12:00',
  '12:00 - 1:30',
  '1:30 - 3:00',
  '3:00 - 4:30',
  '4:30 - 6:00',
  '6:00 - 7:30',
  '7:30 - 9:00 PM',
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─────────────────────────────────────────────
//  STORAGE HELPERS
// ─────────────────────────────────────────────
//  STORAGE HELPERS — now backed by API
// ─────────────────────────────────────────────
let availabilityData = null;

async function loadAvailability() {
  try {
    availabilityData = await API.getMyAvailability();
    return availabilityData.submission;
  } catch (err) {
    console.error('Failed to load availability:', err);
    return null;
  }
}

function isFinalized() {
  return availabilityData?.submission?.status === 'submitted' || 
         availabilityData?.submission?.status === 'approved';
}

// ─────────────────────────────────────────────
//  STATUS BADGE
// ─────────────────────────────────────────────
function renderStatusBadge(finalized) {
  const badge = document.getElementById('vsStatusBadge');
  if (!badge) return;

  if (finalized) {
    badge.className = 'vs-badge vs-badge--submitted';
    badge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Submitted`;
  } else {
    badge.className = 'vs-badge vs-badge--pending';
    badge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.6"/>
        <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      Pending Request`;
  }
}

// ─────────────────────────────────────────────
//  FINALIZE BUTTON
// ─────────────────────────────────────────────
function updateFinalizeBtn(finalized) {
  const btn = document.getElementById('vsFinalizeBtn');
  if (!btn) return;

  if (finalized) {
    btn.disabled = true;
    btn.classList.add('vs-finalize-btn--done');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M2 7L5.5 10.5L12 4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Finalized`;
  } else {
    btn.disabled = false;
    btn.classList.remove('vs-finalize-btn--done');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M2 7L5.5 10.5L12 4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Finalize Submission`;
  }
}

document.getElementById('vsFinalizeBtn')?.addEventListener('click', async () => {
  if (isFinalized()) return;

  const confirmed = window.confirm(
    'Finalize your availability submission?\n\nOnce finalized, you will no longer be able to add or edit slots.'
  );
  if (!confirmed) return;

  try {
    await API.finalizeAvailability();
    await init(); // Refresh the page data
    alert('Your availability has been submitted successfully!');
  } catch (err) {
    alert('Failed to finalize: ' + err.message);
  }
});

// ─────────────────────────────────────────────
//  SUMMARY STRIP
// ─────────────────────────────────────────────
function renderSummary(slots, finalized) {
  const container = document.getElementById('vsSummary');
  if (!container) return;

  // Count total checked cells across all slots
  let totalCells = 0;
  slots.forEach(s => {
    totalCells += (s.dayIndices || []).length * (s.times || []).length;
  });

  // Unique days across all slots
  const allDays = new Set();
  slots.forEach(s => (s.dayIndices || []).forEach(d => allDays.add(d)));

  const chips = [
    {
      icon: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
               <rect x="2" y="4" width="16" height="14" rx="3" stroke="#800000" stroke-width="1.7"/>
               <path d="M2 9H18" stroke="#800000" stroke-width="1.7"/>
               <rect x="5" y="2" width="2" height="4" rx="1" fill="#800000"/>
               <rect x="13" y="2" width="2" height="4" rx="1" fill="#800000"/>
             </svg>`,
      val: slots.length,
      lbl: 'Total Slots',
    },
    {
      icon: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
               <circle cx="10" cy="10" r="7.5" stroke="#800000" stroke-width="1.7"/>
               <path d="M10 6V10L13 13" stroke="#800000" stroke-width="1.7" stroke-linecap="round"/>
             </svg>`,
      val: `${totalCells} blocks`,
      lbl: 'Availability Cells',
    },
    {
      icon: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
               <path d="M4 10h12M4 14h8M4 6h12" stroke="#800000" stroke-width="1.7" stroke-linecap="round"/>
             </svg>`,
      val: allDays.size,
      lbl: 'Days Covered',
    },
    {
      icon: `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
               <path d="M2 6L5.5 9.5L10 5M2 13L5.5 16.5L10 12" stroke="#800000" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
               <path d="M13 8h5M13 15h5" stroke="#800000" stroke-width="1.7" stroke-linecap="round"/>
             </svg>`,
      val: finalized ? 'Submitted' : 'Pending Request',
      lbl: 'Status',
    },
  ];

  container.innerHTML = chips.map(c => `
    <div class="vs-summary-chip">
      <div class="vs-summary-chip__icon">${c.icon}</div>
      <div>
        <p class="vs-summary-chip__val">${c.val}</p>
        <p class="vs-summary-chip__lbl">${c.lbl}</p>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
//  PER-SLOT TIMETABLE CARDS
// ─────────────────────────────────────────────
function renderSlots(slots, finalized) {
  const container = document.getElementById('vsSlots');
  if (!container) return;
  container.innerHTML = '';

  if (!slots.length) {
    container.innerHTML = `
      <div class="vs-empty">
        <div class="vs-empty__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="3" stroke="#800000" stroke-width="1.8"/>
            <path d="M3 10H21" stroke="#800000" stroke-width="1.8"/>
            <rect x="7" y="3" width="2" height="4" rx="1" fill="#800000"/>
            <rect x="15" y="3" width="2" height="4" rx="1" fill="#800000"/>
          </svg>
        </div>
        <p class="vs-empty__title">No availability submitted yet</p>
        <p class="vs-empty__sub">Add your schedule preferences from the dashboard.</p>
        <a href="add-availability.html" class="vs-empty__btn">+ Add Availability</a>
      </div>
    `;
    return;
  }

  slots.forEach((slot, idx) => {
    const slotNum      = idx + 1;
    const dayIndices   = slot.dayIndices || [];
    const checkedTimes = slot.times      || [];
    const timeLabel    = slot.timeLabel  || '—';

    // Day pills
    const dayPillsHTML = DAY_LABELS.map((lbl, i) => {
      const on = dayIndices.includes(i);
      return `<span class="vs-slot__day-pill vs-slot__day-pill--${on ? 'on' : 'off'}">${lbl}</span>`;
    }).join('');

    // Timetable rows
    const rowsHTML = TIME_SLOTS.map(timeSlot => {
      const isTimeChecked = checkedTimes.includes(timeSlot);

      const dayCells = DAY_FULL.map((_, colIdx) => {
        const checked = isTimeChecked && dayIndices.includes(colIdx);
        return `<td><div class="vs-table__cell vs-table__cell--${checked ? 'checked' : 'empty'}"></div></td>`;
      }).join('');

      return `<tr><td>${timeSlot}</td>${dayCells}</tr>`;
    }).join('');

    // Column headers
    const headersHTML = DAY_FULL.map((day, i) => {
      const cls = i === 5 ? ' vs-table__th--sat' : '';
      return `<th class="vs-table__th${cls}">${day.toUpperCase()}</th>`;
    }).join('');

    // Edit link: only shown when NOT finalized
    const editLinkHTML = finalized
      ? `<span class="vs-slot__locked-label">
           <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
             <rect x="3" y="6" width="8" height="6" rx="2" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
             <path d="M5 6V4.5a2 2 0 0 1 4 0V6" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round"/>
           </svg>
           Locked
         </span>`
      : `<a href="edit-availability.html?slot=${slotNum}" class="vs-slot__edit-link">
           <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
             <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
           </svg>
           Edit Slot
         </a>`;

    const card = document.createElement('div');
    card.className = 'vs-slot';
    card.innerHTML = `
      <div class="vs-slot__header">
        <div class="vs-slot__header-left">
          <span class="vs-slot__num">SLOT ${slotNum}</span>
          <span class="vs-slot__time-badge">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="white" stroke-width="1.4"/>
              <path d="M7 4V7L9.5 9" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            ${timeLabel}
          </span>
          <div class="vs-slot__days-row">${dayPillsHTML}</div>
        </div>
        ${editLinkHTML}
      </div>

      <div class="vs-table-wrap">
        <table class="vs-table">
          <thead>
            <tr>
              <th class="vs-table__th vs-table__th--time">TIME</th>
              ${headersHTML}
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
    `;

    container.appendChild(card);
  });
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
async function init() {
  const sub = await loadAvailability();
  // API slots (day_indices + time range) → the {dayIndices, times, timeLabel}
  // cards this page draws. One card per stored slot so "Edit Slot" stays 1:1.
  const slots = AvailabilityUtils.buildSlotCards(sub?.slots || []);
  const finalized = isFinalized();

  renderStatusBadge(finalized);
  updateFinalizeBtn(finalized);
  renderSummary(slots, finalized);
  renderSlots(slots, finalized);
}

init();

// ─────────────────────────────────────────────
//  RESUBMIT HISTORY
//  Every finalized submission is snapshotted in the database. From here the
//  faculty member can drop a past one into this semester's form ("Load into
//  form" — review/edit, then finalize as usual) or resubmit it straight away.
// ─────────────────────────────────────────────
const DAY_SHORT = DAY_FULL.map(d => d.slice(0, 3));

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtHistoryDate(iso) {
  if (!iso) return 'Date not recorded';
  // API sends UTC without a zone suffix; add one so it shows in local time.
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  return isNaN(d) ? 'Date not recorded'
                  : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function historyEntryHtml(h, canApply) {
  const cards  = AvailabilityUtils.buildSlotCards(h.slots);
  const blocks = cards.reduce((n, c) => n + c.dayIndices.length * c.times.length, 0);

  const slotLines = cards.map((c, i) => `
    <div class="vh-slot">
      <span class="vh-slot__num">Slot ${i + 1}</span>
      <span class="vh-slot__days">${c.dayIndices.map(d => DAY_SHORT[d] || '').join(' ')}</span>
      <span class="vh-slot__time">${esc(c.timeLabel)}</span>
    </div>`).join('');

  const dis = canApply ? '' : ' disabled';
  return `
    <div class="vh-item" data-id="${h.id}">
      <div class="vh-item__top">
        <div>
          <p class="vh-item__sem">${esc(h.semester_label || 'Semester')}${
            h.is_current_semester ? ' <span class="vh-tag">This semester</span>' : ''}</p>
          <p class="vh-item__meta">Submitted ${esc(fmtHistoryDate(h.submitted_at))}
            &middot; ${cards.length} ${cards.length === 1 ? 'slot' : 'slots'} &middot; ${blocks} blocks</p>
        </div>
        <div class="vh-item__actions">
          <button type="button" class="vh-btn vh-btn--outline" data-act="load"${dis}>Load into form</button>
          <button type="button" class="vh-btn vh-btn--solid" data-act="resubmit"${dis}>Resubmit</button>
        </div>
      </div>
      <div class="vh-slots">${slotLines}</div>
    </div>`;
}

async function openHistoryModal() {
  let data;
  try {
    data = await API.getAvailabilityHistory();
  } catch (err) {
    alert('Could not load your submission history: ' + err.message);
    return;
  }
  const entries  = data.history || [];
  const canApply = !!data.can_apply;

  const overlay = document.createElement('div');
  overlay.className = 'vh-overlay';
  overlay.innerHTML = `
    <div class="vh-modal" role="dialog" aria-modal="true" aria-labelledby="vhTitle">
      <div class="vh-modal__header">
        <p class="vh-modal__title" id="vhTitle">RESUBMIT HISTORY</p>
        <button type="button" class="vh-modal__close" id="vhClose" aria-label="Close">&times;</button>
      </div>
      <div class="vh-modal__body">
        <p class="vh-modal__note${canApply ? '' : ' vh-modal__note--warn'}">${
          canApply
            ? '<strong>Load into form</strong> puts a previous submission in your availability form so you can review or edit it before finalizing. <strong>Resubmit</strong> sends it to the chairperson right away.'
            : `Your current submission is already <strong>${esc(data.current_status)}</strong>, so it can’t be replaced. You can reuse a previous one while your submission is pending or returned.`
        }</p>
        <div class="vh-list">${
          entries.length
            ? entries.map(h => historyEntryHtml(h, canApply)).join('')
            : '<p class="vh-empty">No previous submissions yet. Once you finalize an availability submission, it will appear here.</p>'
        }</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#vhClose').addEventListener('click', close);

  overlay.querySelector('.vh-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn || btn.disabled) return;
    const id     = Number(btn.closest('.vh-item').dataset.id);
    const submit = btn.dataset.act === 'resubmit';
    const entry  = entries.find(h => h.id === id);

    if (submit && !window.confirm(
      `Resubmit your ${entry?.semester_label || 'previous'} availability now?\n\n` +
      'It replaces anything in your current form and is sent to the chairperson for review.'
    )) return;
    if (!submit && (storedSlotCount() > 0) && !window.confirm(
      'Loading will replace the slots currently in your availability form. Continue?'
    )) return;

    overlay.querySelectorAll('button[data-act]').forEach(b => { b.disabled = true; });
    try {
      await API.applyAvailabilityHistory(id, submit);
      close();
      await init();
      alert(submit
        ? 'Your previous availability was resubmitted successfully!'
        : 'Previous availability loaded. Review it, then click Finalize Submission.');
    } catch (err) {
      overlay.querySelectorAll('button[data-act]').forEach(b => { b.disabled = false; });
      alert('Failed: ' + err.message);
    }
  });
}

function storedSlotCount() {
  return availabilityData?.submission?.slots?.length || 0;
}

document.getElementById('vsHistoryBtn')?.addEventListener('click', openHistoryModal);

