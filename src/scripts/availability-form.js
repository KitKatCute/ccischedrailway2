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
//  STORAGE HELPERS — now backed by API
// ─────────────────────────────────────────────
let availabilityData = null; // { submission, semester }

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

// Same as loadAvailability() but lets errors through, so a save never runs
// against a failed load (which would look like "no existing slots" and wipe them).
async function fetchAvailability() {
  availabilityData = await API.getMyAvailability();
  return availabilityData.submission;
}

// Stored slots in slot_number order (the order every page numbers them in)
function storedSlots() {
  return AvailabilityUtils.sortSlots(availabilityData?.submission?.slots);
}

// The stored slot being edited — matched by slot_number, falling back to position
function findEditedSlot(slots) {
  const byNumber = slots.findIndex(s => s.slot_number === slotNum);
  return byNumber !== -1 ? byNumber : (slots[slotNum - 1] ? slotNum - 1 : -1);
}

// ─────────────────────────────────────────────
//  DETECT MODE: add vs edit
// ─────────────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const slotNum = parseInt(params.get('slot'), 10) || null;  // 1-based
const isEdit  = window.location.pathname.includes('edit-availability');

// Update dynamic text for edit mode
if (isEdit && slotNum) {
  const slotBadge  = document.getElementById('slotBadge');
  const pageTitle  = document.getElementById('pageTitle');
  const pageSub    = document.getElementById('pageSub');
  const breadcrumb = document.getElementById('breadcrumbCurrent');

  if (slotBadge)  slotBadge.textContent  = `SLOT ${slotNum}`;
  if (pageTitle)  pageTitle.textContent  = `Edit Availability — Slot ${slotNum}`;
  if (pageSub)    pageSub.textContent    = `Modifying Slot ${slotNum} preferences for this semester`;
  if (breadcrumb) breadcrumb.textContent = `Edit Availability — Slot ${slotNum}`;
}

// ─────────────────────────────────────────────
//  TIMETABLE
// ─────────────────────────────────────────────
const TIME_SLOTS = AvailabilityUtils.TIME_BLOCKS.map(b => b.label);

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildTable() {
  const tbody = document.getElementById('availTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let savedDayIndices = [];
  let savedTimes      = [];

  if (isEdit && slotNum) {
    const slots = storedSlots();
    const idx   = findEditedSlot(slots);
    const range = idx !== -1 && AvailabilityUtils.slotRange(slots[idx]);
    if (range) {
      savedDayIndices = slots[idx].day_indices || [];
      savedTimes      = AvailabilityUtils.blocksWithin(range);
    }
  }

  TIME_SLOTS.forEach((timeSlot) => {
    const tr = document.createElement('tr');

    const tdTime = document.createElement('td');
    tdTime.textContent = timeSlot;
    tr.appendChild(tdTime);

    DAY_NAMES.forEach((_, colIdx) => {
      const td = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.setAttribute('aria-label', `${timeSlot} ${DAY_NAMES[colIdx]}`);

      if (isEdit && savedDayIndices.includes(colIdx) && savedTimes.includes(timeSlot)) {
        cb.checked = true;
      }

      td.appendChild(cb);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}


// ─────────────────────────────────────────────
//  FINALIZATION GUARD — applied after table build
// ─────────────────────────────────────────────
function applyFinalizedLock() {
  if (!isFinalized()) return;

  document.querySelectorAll('#availTableBody input[type="checkbox"]').forEach(cb => {
    cb.disabled = true;
  });

  document.querySelectorAll('.af-select').forEach(sel => {
    sel.disabled = true;
  });

  const footer = document.querySelector('.af-card__footer');
  if (footer) {
    footer.innerHTML = `
      <div class="af-locked-notice">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2.5" y="6" width="9" height="7" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Availability has been finalized and can no longer be edited.
        <a href="view-submission.html" class="af-locked-link">View submission</a>
      </div>`;
  }

  const cardHeader = document.querySelector('.af-card__header');
  if (cardHeader && !document.getElementById('finalizedBanner')) {
    const banner = document.createElement('div');
    banner.id        = 'finalizedBanner';
    banner.className = 'af-finalized-banner';
    banner.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2.5" y="6" width="9" height="7" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      This submission has been finalized. No further changes are allowed.`;
    cardHeader.insertAdjacentElement('afterend', banner);
  }
}

// Both the pre-filled checkboxes (edit mode) and the finalized lock depend on
// the saved submission, so wait for it before drawing anything.
(async function initForm() {
  await loadAvailability();
  buildTable();
  applyFinalizedLock();
})();

// ─────────────────────────────────────────────
//  GATHER SELECTIONS
// ─────────────────────────────────────────────
function gatherSelections() {
  const results = [];
  document.querySelectorAll('#availTableBody tr').forEach((tr, rowIdx) => {
    tr.querySelectorAll('input[type="checkbox"]').forEach((cb, colIdx) => {
      if (cb.checked) results.push({ timeIdx: rowIdx, dayIdx: colIdx });
    });
  });
  return results;
}

// Turn the ticked cells into stored slots. A stored slot is a set of days
// plus ONE continuous time range, so each day's ticked rows are split into
// contiguous runs and days that share the same run are grouped into one slot.
// Two separate blocks on the same day therefore become two slots, instead of
// one range that silently swallows the gap between them.
function selectionsToSlots(selections) {
  const U = AvailabilityUtils;

  const rowsByDay = new Map();
  selections.forEach(({ timeIdx, dayIdx }) => {
    if (!rowsByDay.has(dayIdx)) rowsByDay.set(dayIdx, new Set());
    rowsByDay.get(dayIdx).add(timeIdx);
  });

  const groups = new Map();   // "firstRow-lastRow" → { first, last, days }
  const addRun = (day, first, last) => {
    const key = `${first}-${last}`;
    if (!groups.has(key)) groups.set(key, { first, last, days: [] });
    groups.get(key).days.push(day);
  };

  rowsByDay.forEach((rowSet, day) => {
    const rows = [...rowSet].sort((a, b) => a - b);
    let first = rows[0];
    let last  = rows[0];
    rows.slice(1).forEach(r => {
      if (r === last + 1) { last = r; return; }
      addRun(day, first, last);
      first = last = r;
    });
    addRun(day, first, last);
  });

  // Times come straight from the grid rows — never guessed from their text
  return [...groups.values()]
    .sort((a, b) => a.first - b.first || a.last - b.last)
    .map(g => {
      const start = U.TIME_BLOCKS[g.first].start;
      const end   = U.TIME_BLOCKS[g.last].end;
      return {
        day_indices: g.days.sort((a, b) => a - b),
        time_start:  U.toClock24(start),
        time_end:    U.toClock24(end),
        time_label:  `${U.fmtClock(start)} – ${U.fmtClock(end)}`,
      };
    });
}

// ─────────────────────────────────────────────
//  ADD BUTTON — save new slot via API
// ─────────────────────────────────────────────
const addBtn = document.getElementById('addBtn');
if (addBtn) {
  addBtn.addEventListener('click', async () => {
    if (isFinalized()) {
      alert('Your availability has been finalized and can no longer be changed.');
      return;
    }
    const selections = gatherSelections();
    if (!selections.length) {
      alert('Please select at least one time slot before adding.');
      return;
    }
    const newSlots = selectionsToSlots(selections);

    // Re-read what's stored so we append to the latest version
    let sub;
    try {
      sub = await fetchAvailability();
    } catch (err) {
      alert('Could not load your current availability: ' + err.message);
      return;
    }

    const apiSlots = [...AvailabilityUtils.sortSlots(sub?.slots), ...newSlots]
      .map((s, i) => AvailabilityUtils.toPayload(s, i + 1));

    try {
      await API.saveAvailability(apiSlots);
      window.location.href = 'dashboard.html';
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  });
}

// ─────────────────────────────────────────────
//  SAVE BUTTON (edit mode) — update slot via API
// ─────────────────────────────────────────────
const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    if (isFinalized()) {
      alert('Your availability has been finalized and can no longer be changed.');
      return;
    }
    const selections = gatherSelections();
    if (!selections.length) {
      alert('Please select at least one time slot.');
      return;
    }
    const newSlots = selectionsToSlots(selections);

    let sub;
    try {
      sub = await fetchAvailability();
    } catch (err) {
      alert('Could not load your current availability: ' + err.message);
      return;
    }

    // Replace the slot being edited with what is now ticked (which may be
    // more than one slot if the selection has gaps), then renumber.
    const existing = AvailabilityUtils.sortSlots(sub?.slots);
    const idx = findEditedSlot(existing);
    if (idx === -1) {
      alert('This slot no longer exists.');
      return;
    }
    existing.splice(idx, 1, ...newSlots);
    const apiSlots = existing.map((s, i) => AvailabilityUtils.toPayload(s, i + 1));

    try {
      await API.saveAvailability(apiSlots);
      window.location.href = 'dashboard.html';
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  });
}

// ─────────────────────────────────────────────
//  VIEW HISTORY MODAL
//  Reads the faculty member's real submission history from the API
//  (GET /api/availability/history) — nothing is hardcoded. Every submission
//  they finalize is saved there automatically, and the matrix-seeded past
//  semesters show up too. Each entry can be loaded into the form or resubmitted.
// ─────────────────────────────────────────────
const HIST_DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const HIST_ICON_CLOCK = `
  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
    <path d="M7 4V7L9.5 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;

const HIST_ICON_CAL = `
  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="2" width="12" height="11" rx="2.5" stroke="currentColor" stroke-width="1.3"/>
    <path d="M1 5.5h12" stroke="currentColor" stroke-width="1.3"/>
    <rect x="3.5" y=".5" width="1.5" height="3.5" rx=".75" fill="currentColor"/>
    <rect x="9" y=".5" width="1.5" height="3.5" rx=".75" fill="currentColor"/>
  </svg>`;

function histEsc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function histDate(iso) {
  if (!iso) return 'Date not recorded';
  // API sends UTC without a zone suffix; add one so it shows in local time.
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  return isNaN(d) ? 'Date not recorded'
                  : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function histEntryHTML(h, canApply) {
  const sem      = h.semester || {};
  const semName  = histEsc(String(sem.semester_term || 'Semester').replace(/^(\d)(st|nd|rd|th) Term$/, '$1$2 Semester'));
  const ay       = sem.academic_year ? 'AY ' + histEsc(String(sem.academic_year).replace('-', '–')) : '';
  const cards    = AvailabilityUtils.buildSlotCards(h.slots, { merge: true });

  const slotsHTML = cards.length
    ? cards.map((c, i) => `
      <div class="hist-slot">
        <span class="hist-slot__label">Slot ${i + 1}</span>
        <span class="hist-slot__days">${c.dayIndices.map(d => HIST_DAY_SHORT[d] || '').join(', ')}</span>
        <span class="hist-slot__time">${HIST_ICON_CLOCK} ${histEsc(c.timeLabel)}</span>
      </div>`).join('')
    : '<div class="hist-slot"><span class="hist-slot__days">No slots recorded</span></div>';

  const dis = (canApply && cards.length) ? '' : ' disabled';
  return `
    <div class="hist-entry" data-id="${h.id}">
      <div class="hist-entry__header">
        <div class="hist-entry__sem">
          <span class="hist-entry__sem-name">${semName}</span>
          <span class="hist-entry__ay">${ay}</span>
          ${h.is_current_semester ? '<span class="hist-tag">This semester</span>' : ''}
        </div>
        <span class="hist-entry__date">${HIST_ICON_CAL} Submitted ${histEsc(histDate(h.submitted_at))}</span>
      </div>
      <div class="hist-entry__slots">${slotsHTML}</div>
      <div class="hist-entry__actions">
        <button type="button" class="hist-btn hist-btn--outline" data-act="load"${dis}>Load into form</button>
        <button type="button" class="hist-btn hist-btn--solid" data-act="resubmit"${dis}>Resubmit</button>
      </div>
    </div>`;
}

function ensureHistoryModal() {
  if (document.getElementById('historyModal')) return;

  const modal = document.createElement('div');
  modal.id        = 'historyModal';
  modal.className = 'hist-modal-backdrop';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'histModalTitle');
  modal.innerHTML = `
    <div class="hist-modal">
      <div class="hist-modal__header">
        <div class="hist-modal__title-wrap">
          <div class="hist-modal__icon">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="white" stroke-width="1.4"/>
              <path d="M7 4V7L5 9" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M4.5 2.5C5.4 2 6.2 1.8 7 1.8" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <p class="hist-modal__title" id="histModalTitle">Availability History</p>
            <p class="hist-modal__sub">Past semester submissions</p>
          </div>
        </div>
        <button class="hist-modal__close" id="histModalClose" aria-label="Close history">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="hist-modal__body" id="histModalBody"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeHistoryModal();
  });
  document.getElementById('histModalClose').addEventListener('click', closeHistoryModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('hist-modal-backdrop--open')) {
      closeHistoryModal();
    }
  });
  document.getElementById('histModalBody').addEventListener('click', onHistoryAction);
}

let historyEntries = [];

async function renderHistoryBody() {
  const body = document.getElementById('histModalBody');
  body.innerHTML = '<p class="hist-state">Loading your history…</p>';
  try {
    const data = await API.getAvailabilityHistory();
    historyEntries = data.history || [];
    const canApply = !!data.can_apply;

    const note = !historyEntries.length ? '' : (canApply
      ? '<p class="hist-note"><strong>Load into form</strong> lets you review a past submission before finalizing. <strong>Resubmit</strong> sends it to the chairperson right away.</p>'
      : `<p class="hist-note hist-note--warn">Your current submission is already <strong>${histEsc(data.current_status)}</strong>, so it can’t be replaced. You can reuse a past one while your submission is pending or returned.</p>`);

    body.innerHTML = historyEntries.length
      ? note + historyEntries.map(h => histEntryHTML(h, canApply)).join('')
      : '<p class="hist-state">No past submissions yet. Once you finalize an availability submission, it will appear here.</p>';
  } catch (err) {
    body.innerHTML = `<p class="hist-state hist-state--error">Could not load your history: ${histEsc(err.message)}</p>`;
  }
}

async function onHistoryAction(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn || btn.disabled) return;

  const id     = Number(btn.closest('.hist-entry').dataset.id);
  const submit = btn.dataset.act === 'resubmit';
  const entry  = historyEntries.find(h => h.id === id);
  const label  = entry?.semester_label || 'previous';

  if (submit) {
    if (!window.confirm(
      `Resubmit your ${label} availability now?\n\n` +
      'It replaces anything in your current form and is sent to the chairperson for review.'
    )) return;
  } else if ((availabilityData?.submission?.slots?.length || 0) > 0) {
    if (!window.confirm('Loading will replace the slots currently in your availability form. Continue?')) return;
  }

  const buttons = document.querySelectorAll('#histModalBody button[data-act]');
  buttons.forEach(b => { b.disabled = true; });
  try {
    await API.applyAvailabilityHistory(id, submit);
    alert(submit
      ? 'Your previous availability was resubmitted successfully!'
      : 'Previous availability loaded. Review it, then click Finalize Submission.');
    window.location.href = 'view-submission.html';
  } catch (err) {
    buttons.forEach(b => { b.disabled = false; });
    alert('Failed: ' + err.message);
  }
}

function openHistoryModal() {
  ensureHistoryModal();
  document.getElementById('historyModal').classList.add('hist-modal-backdrop--open');
  document.body.style.overflow = 'hidden';
  renderHistoryBody();
}

function closeHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (!modal) return;
  modal.classList.remove('hist-modal-backdrop--open');
  document.body.style.overflow = '';
}

const viewHistoryBtn = document.getElementById('viewHistoryBtn');
if (viewHistoryBtn) {
  viewHistoryBtn.addEventListener('click', openHistoryModal);
}
