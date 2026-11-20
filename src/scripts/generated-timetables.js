'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ─────────────────────────────────────────────
//  META LABEL  (AY / Semester passed via URL)
// ─────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const ayParam  = params.get('ay')  || 'A.Y. 2025–2026';
const semParam = params.get('sem') || '1st Semester';

const gtMeta = document.getElementById('gtMeta');
if (gtMeta) gtMeta.textContent = `${ayParam} \u00a0·\u00a0 ${semParam}`;

// Pre-select the matching term in the dropdown
const gtTermEl = document.getElementById('gtTerm');
if (gtTermEl) {
  const semLower = semParam.toLowerCase();
  if (semLower.includes('2nd'))    gtTermEl.value = '2nd';
  else if (semLower.includes('sum')) gtTermEl.value = 'summer';
  else                              gtTermEl.value = '1st';
}

// ─────────────────────────────────────────────
//  LOAD RESULT FROM SESSION STORAGE
//  Written by chairperson-schedule.js after the
//  /api/generate call completes.
// ─────────────────────────────────────────────
let _apiResult = null;
try {
  const raw = sessionStorage.getItem('ccisched_result');
  if (raw) _apiResult = JSON.parse(raw);
} catch (_) { /* ignore parse errors */ }

/**
 * Map the backend faculty_data array into the shape this page's
 * renderRows() expects:
 *   { id, name, profileHref, courses: string[], courseDetails }
 * courseDetails (code/title/section/days/time/units) is carried through
 * for the PDF export, which needs real columns rather than one bundled
 * display string.
 */
function _buildFacultyData(apiResult) {
  if (!apiResult?.faculty_data?.length) return null;
  return apiResult.faculty_data.map(f => ({
    id:             f.id,
    name:           f.name,
    profileHref:    'assignment-detail.html',
    courses:        f.courses,        // already "CS101 – Introduction to Computing"
    courseDetails:  f.course_details || [],
  }));
}

const FACULTY_DATA = _buildFacultyData(_apiResult);

if (!FACULTY_DATA) {
  const tableBody = document.getElementById('gtTableBody');
  if (tableBody) {
    tableBody.innerHTML = `<div class="gt-empty"><p class="gt-empty__text">ERROR: NO GENERATED TIMETABLE DATA IS AVAILABLE.</p></div>`;
  }
}


// ─────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────
const tableBody = document.getElementById('gtTableBody');

function renderRows(data) {
  if (!tableBody) return;
  if (!Array.isArray(data)) return;
  tableBody.innerHTML = '';

  if (!data.length) {
    tableBody.innerHTML = `
      <div class="gt-empty">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="8" width="32" height="28" rx="5" stroke="white" stroke-width="2"/>
          <path d="M4 16h32" stroke="white" stroke-width="2"/>
          <circle cx="13" cy="24" r="2" fill="white"/>
          <circle cx="20" cy="24" r="2" fill="white"/>
          <circle cx="27" cy="24" r="2" fill="white"/>
        </svg>
        <p class="gt-empty__text">NO MATCHING FACULTY FOUND</p>
      </div>`;
    return;
  }

  data.forEach((faculty, i) => {
    const row = document.createElement('div');
    row.className = 'gt-row';
    row.style.animationDelay = `${i * 60}ms`;

    const coursesHTML = faculty.courses
      .map(c => `<p class="gt-course-item">${c}</p>`)
      .join('');

    // Build the faculty timetable URL with name, AY, sem, and back-link params
    const timetableUrl = `faculty-timetable.html?name=${encodeURIComponent(faculty.name)}&ay=${encodeURIComponent(ayParam)}&sem=${encodeURIComponent(semParam)}&from=generated-timetables.html`;

    row.innerHTML = `
      <div class="gt-row__faculty">
        <span class="gt-row__name" data-href="${timetableUrl}">${faculty.name}</span>
        <button class="gt-profile-btn" data-href="${timetableUrl}">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="5" r="3" stroke="currentColor" stroke-width="1.4"/>
            <path d="M2 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          Profile
        </button>
      </div>
      <div class="gt-row__courses">${coursesHTML}</div>
    `;

    tableBody.appendChild(row);
  });
}

renderRows(FACULTY_DATA);

// ─────────────────────────────────────────────
//  SEARCH FILTER
// ─────────────────────────────────────────────
document.getElementById('gtSearch')?.addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = q
    ? FACULTY_DATA.filter(f => f.name.toLowerCase().includes(q))
    : FACULTY_DATA;
  renderRows(filtered);
});

// ─────────────────────────────────────────────
//  TERM FILTER
// ─────────────────────────────────────────────
document.getElementById('gtTerm')?.addEventListener('change', () => {
  // In a real app you'd re-fetch or filter by semester.
  // For now just show all data to keep the UI responsive.
  renderRows(FACULTY_DATA);
});

// ─────────────────────────────────────────────
//  ROW DELEGATION  (Profile button + name click)
// ─────────────────────────────────────────────
tableBody?.addEventListener('click', e => {
  const btn  = e.target.closest('.gt-profile-btn');
  const name = e.target.closest('.gt-row__name');
  const href = (btn || name)?.dataset?.href;
  if (href) window.location.href = href;
});

// ─────────────────────────────────────────────
//  ACTION BUTTONS
// ─────────────────────────────────────────────
document.getElementById('exportPdfBtn')?.addEventListener('click', exportAllToPDF);
document.getElementById('printPdfBtn')?.addEventListener('click', printAllPDF);

document.getElementById('distributeBtn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;

  if (!_apiResult?.assignments?.length) {
    alert('No generated assignments found to distribute. Please generate a schedule first.');
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Distributing…';

  try {
    await API.publishSchedule(_apiResult.assignments);
    // Navigate to the schedule dashboard; the ?distributed=1 flag
    // tells that page to show the success notification on arrival.
    window.location.href = `schedule.html?distributed=1`;
  } catch (err) {
    alert('Failed to distribute schedule: ' + err.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// ─────────────────────────────────────────────
//  PDF EXPORT — real, direct file download via jsPDF + autoTable
//  (previously opened a print dialog and relied on the user manually
//  choosing "Save as PDF" themselves)
// ─────────────────────────────────────────────
function buildTimetablesPDF() {
  if (!FACULTY_DATA.length) {
    showToast('No generated timetable data to export.', 'error');
    return null;
  }
  if (!window.jspdf?.jsPDF) {
    showToast('PDF library failed to load — check your connection and try again.', 'error');
    return null;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const INK     = [17, 17, 17];
  const RULE    = [170, 170, 170];
  const margin  = 40;
  const pageW   = doc.internal.pageSize.getWidth();
  const pageH   = doc.internal.pageSize.getHeight();
  let y = margin;

  const L = pdfLetterheadLayout(doc, margin);
  y = drawPdfTitle(doc, L, 'GENERATED TIMETABLES', `${ayParam}   \u00b7   ${semParam}`);

  FACULTY_DATA.forEach(faculty => {
    if (y > L.contentBottom - 70) { doc.addPage(); y = L.contentTop; }
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(faculty.name, margin, y);
    y += 8;

    // Prefer the structured per-course data (real Day/Time/Units columns);
    // fall back to the single bundled display string if it's ever missing.
    const hasDetails = faculty.courseDetails && faculty.courseDetails.length;
    const head = hasDetails
      ? [['Code', 'Course', 'Section', 'Day & Time', 'Units']]
      : [['Assigned Courses & Sections']];
    const body = hasDetails
      ? faculty.courseDetails.map(c => [
          c.code, c.title, c.section,
          c.days ? `${c.days}, ${c.time}` : '\u2014',
          String(c.units),
        ])
      : faculty.courses.map(c => [c]);

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin, top: L.contentTop, bottom: pageH - L.contentBottom },
      head, body,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: [204, 204, 204], lineWidth: 0.6 },
      headStyles: { fillColor: [255, 255, 255], textColor: INK, fontSize: 8, fontStyle: 'bold', lineColor: RULE, lineWidth: 0.8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    y = doc.lastAutoTable.finalY + 20;
  });

  applyPdfLetterhead(doc, L);

  const ay  = ayParam.replace(/\s+/g, '');
  const sem = semParam.replace(/\s+/g, '');
  return { doc, filename: `Timetable_${ay}_${sem}.pdf` };
}

async function exportAllToPDF() {
  await loadPdfLetterhead();
  const result = buildTimetablesPDF();
  if (!result) return;
  result.doc.save(result.filename);
  showToast('PDF saved.');
}

async function printAllPDF() {
  await loadPdfLetterhead();
  const result = buildTimetablesPDF();
  if (!result) return;
  printPdfDoc(result.doc);
}

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
const toastEl = document.getElementById('gtToast');
let toastTimer = null;

function showToast(msg, type = 'success') {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.background = type === 'warn' ? '#92400E' : 'var(--maroon)';
  toastEl.classList.add('gt-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('gt-toast--show'), 3000);
}
