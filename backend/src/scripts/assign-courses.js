'use strict';


// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ─────────────────────────────────────────────
//  LIVE DATABASE STATE
// ─────────────────────────────────────────────
let FACULTY = [];
let COURSES = [];
let activeDept = 'all';
let activeStatus = 'all';   // all | unassigned | assigned
let selectedCourse = null;
let searchQuery = '';
let pickedSectionIds = new Set();   // sections newly chosen for the selected faculty

function getCourseType(course) {
  return course.type || 'Lecture';
}

function getFacultyById(id) {
  return FACULTY.find(f => Number(f.id) === Number(id));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

// ─────────────────────────────────────────────
//  STATS — calculated from the backend response
// ─────────────────────────────────────────────
function updateStats() {
  const unassigned = COURSES.filter(c => c.status !== 'assigned').length;
  const assigned = COURSES.filter(c => c.status === 'assigned').length;

  document.getElementById('statUnassigned').textContent = unassigned;
  document.getElementById('statAssigned').textContent = assigned;
  document.getElementById('statFaculty').textContent = FACULTY.length;
}

// ─────────────────────────────────────────────
//  RENDER COURSES
// ─────────────────────────────────────────────
function renderCourses() {
  const list = document.getElementById('coursesList');
  if (!list) return;

  list.innerHTML = '';

  const query = searchQuery.trim().toLowerCase();
  const filtered = COURSES.filter(course => {
    const matchDept = activeDept === 'all' || course.dept === activeDept;
    const matchSearch = !query ||
      String(course.name || '').toLowerCase().includes(query) ||
      String(course.code || '').toLowerCase().includes(query);
    const isAssigned = course.status === 'assigned';
    const matchStatus = activeStatus === 'all' ||
      (activeStatus === 'assigned' ? isAssigned : !isAssigned);
    return matchDept && matchSearch && matchStatus;
  });

  if (!filtered.length) {
    list.innerHTML = `
      <p style="text-align:center;padding:32px;color:rgba(128,0,0,0.40);font-weight:600;font-size:0.88rem;">
        No courses found.
      </p>`;
    return;
  }

  filtered.forEach(course => {
    const isAssigned = course.status === 'assigned';
    const isSelected = selectedCourse?.id === course.id;
    const assignedFaculty = course.assignedTo ? getFacultyById(course.assignedTo) : null;

    const card = document.createElement('div');
    card.className = `course-card${isAssigned ? ' course-card--assigned' : ''}${isSelected ? ' course-card--selected' : ''}`;
    card.dataset.id = course.id;

    const assignmentLabel = isAssigned
      ? `Assigned${assignedFaculty ? ` · ${escapeHtml(assignedFaculty.name.split(' ').slice(-1)[0])}` : ''}`
      : '';


    card.innerHTML = `
      <div class="course-info">
        <p class="course-code">${escapeHtml(course.code)}</p>
        <p class="course-name">${escapeHtml(course.name)}</p>
        <p class="course-meta">${escapeHtml(course.units)} units · ${escapeHtml(getCourseType(course))}</p>
      </div>
      <div class="course-right">
        <span class="dept-tag dept-tag--${escapeHtml(String(course.dept).toLowerCase())}">${escapeHtml(course.dept)}</span>
        ${assignmentLabel ? `<span class="assigned-tag">${assignmentLabel}</span>` : ''}
      </div>
    `;

    // Assigned courses remain selectable so the chairperson can edit/reassign them.
    card.addEventListener('click', () => selectCourse(course));
    list.appendChild(card);
  });
}

// ─────────────────────────────────────────────
//  SELECT COURSE
// ─────────────────────────────────────────────
function selectCourse(course) {
  selectedCourse = course;
  renderCourses();

  document.getElementById('assignEmpty').style.display = 'none';
  document.getElementById('assignForm').style.display = 'flex';

  document.getElementById('selectedCourseInfo').innerHTML = `
    <p class="selected-course__label">Selected Course</p>
    <p class="selected-course__name">${escapeHtml(course.name)}</p>
    <p class="selected-course__meta">
      ${escapeHtml(course.code)} · ${escapeHtml(course.units)} units ·
      ${escapeHtml(getCourseType(course))} · ${escapeHtml(course.dept)}
    </p>
  `;

  const select = document.getElementById('facultySelect');
  select.innerHTML = '<option value="">— Select faculty member —</option>';

  const sorted = [...FACULTY].sort((a, b) => {
    if (a.dept === course.dept && b.dept !== course.dept) return -1;
    if (b.dept === course.dept && a.dept !== course.dept) return 1;
    return (a.currentUnits || 0) - (b.currentUnits || 0) || a.name.localeCompare(b.name);
  });

  sorted.forEach(faculty => {
    const opt = document.createElement('option');
    opt.value = faculty.id;
    opt.textContent = `${faculty.name} (${faculty.dept} · ${faculty.currentUnits || 0}/${faculty.maxUnits} units)`;
    if (Number(course.assignedTo) === Number(faculty.id)) opt.selected = true;
    select.appendChild(opt);
  });

  pickedSectionIds = new Set();

  // Show the existing assignment immediately when editing an assigned course.
  if (course.assignedTo) {
    showFacultyPreview(String(course.assignedTo));
  } else {
    document.getElementById('facultyPreview').style.display = 'none';
    document.getElementById('confirmAssignBtn').disabled = true;
  }

  renderSections();
}

// ─────────────────────────────────────────────
//  SECTION PICKER + LOAD PREVIEW
// ─────────────────────────────────────────────
function currentFacultyId() {
  const v = document.getElementById('facultySelect')?.value;
  return v ? Number(v) : null;
}

// Styling is applied straight from JS (element.style) so the picker looks right
// even if a cached/older stylesheet or HTML file is being served.
const SP = {
  list:  'display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;padding:2px;',
  row:   'display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;' +
         'background:#fff;cursor:pointer;box-sizing:border-box;width:100%;' +
         'transition:border-color .15s,background .15s;',
  name:  'font-size:0.88rem;font-weight:800;color:#800000;line-height:1.2;',
  pill:  'display:inline-block;margin-top:4px;padding:2px 9px;border-radius:99px;' +
         'font-size:0.66rem;font-weight:800;letter-spacing:.02em;',
  head:  'display:flex;align-items:center;justify-content:space-between;width:100%;',
  all:   'background:rgba(128,0,0,0.08);border:none;border-radius:99px;padding:4px 12px;cursor:pointer;' +
         'font-family:inherit;font-size:0.70rem;font-weight:800;color:#800000;',
  sum:   'padding:12px 16px;border-radius:12px;font-size:0.80rem;font-weight:700;line-height:1.45;' +
         'box-sizing:border-box;',
};
const SP_PILL = {
  free:   'background:#E3F4EA;color:#2F7A4D;',            // unassigned
  taken:  'background:#FDF1D6;color:#9A6B00;',            // held by someone else
  mine:   'background:#ECECEC;color:#777;',               // already theirs
};

function renderSections() {
  const group = document.getElementById('sectionGroup');
  const list = document.getElementById('sectionList');
  const facultyId = currentFacultyId();
  const sections = selectedCourse?.sections || [];

  if (!selectedCourse || !facultyId || !sections.length) {
    group.style.display = 'none';
    updateLoadSummary();
    return;
  }

  group.style.display = 'flex';
  group.style.flexDirection = 'column';
  group.style.gap = '10px';

  const head = group.querySelector('.section-pick__head');
  if (head) head.style.cssText = SP.head;
  const allBtn = document.getElementById('sectionSelectAll');
  if (allBtn) allBtn.style.cssText = SP.all;

  list.style.cssText = SP.list;
  list.innerHTML = '';

  sections.forEach(sec => {
    const mine = Number(sec.assignedTo) === facultyId;     // already theirs: locked
    const checked = mine || pickedSectionIds.has(sec.id);
    const otherName = String(sec.assignedToName || '').split(' ').slice(-1)[0];

    let pillText, pillKind;
    if (mine)                { pillText = 'Already assigned';                    pillKind = 'mine';  }
    else if (sec.assignedTo) { pillText = `${otherName} · will be reassigned`;   pillKind = 'taken'; }
    else                     { pillText = 'Unassigned';                          pillKind = 'free';  }

    const row = document.createElement('label');
    const border = checked ? '#800000' : 'rgba(128,0,0,0.18)';
    row.style.cssText = SP.row + `border:2px solid ${border};` +
      (checked ? 'background:rgba(128,0,0,0.05);' : '') + (mine ? 'opacity:.6;cursor:default;' : '');

    row.innerHTML = `
      <input type="checkbox" ${checked ? 'checked' : ''} ${mine ? 'disabled' : ''}
             style="width:17px;height:17px;margin:0;flex-shrink:0;accent-color:#800000;" />
      <span style="display:flex;flex-direction:column;align-items:flex-start;min-width:0;">
        <span style="${SP.name}">${escapeHtml(sec.name)}</span>
        <span style="${SP.pill}${SP_PILL[pillKind]}">${escapeHtml(pillText)}</span>
      </span>
    `;

    if (!mine) {
      row.addEventListener('mouseenter', () => { if (!pickedSectionIds.has(sec.id)) row.style.borderColor = 'rgba(128,0,0,0.45)'; });
      row.addEventListener('mouseleave', () => { if (!pickedSectionIds.has(sec.id)) row.style.borderColor = 'rgba(128,0,0,0.18)'; });
    }
    row.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) pickedSectionIds.add(sec.id);
      else pickedSectionIds.delete(sec.id);
      renderSections();
    });
    list.appendChild(row);
  });

  updateLoadSummary();
}

function updateLoadSummary() {
  const box = document.getElementById('loadSummary');
  const btn = document.getElementById('confirmAssignBtn');
  const faculty = getFacultyById(currentFacultyId());

  if (!faculty || !selectedCourse) {
    box.style.display = 'none';
    return;
  }

  const hasSections = (selectedCourse.sections || []).length > 0;
  const picked = pickedSectionIds.size;
  const addedUnits = picked * (Number(selectedCourse.units) || 0);
  const current = Number(faculty.currentUnits) || 0;
  const max = Number(faculty.maxUnits) || 0;
  const after = current + addedUnits;
  const over = max > 0 && after > max;

  box.style.cssText = SP.sum + (over
    ? 'display:block;border:2px solid #B05555;background:rgba(176,85,85,0.10);color:#954040;'
    : 'display:block;border:2px solid rgba(128,0,0,0.15);background:rgba(128,0,0,0.04);color:rgba(128,0,0,0.75);');

  box.innerHTML = picked
    ? `<div style="font-size:0.66rem;letter-spacing:.06em;text-transform:uppercase;opacity:.75;">Load after assigning</div>` +
      `<div style="font-size:1.05rem;font-weight:900;">${after} / ${max} units ` +
      `<span style="font-size:0.74rem;font-weight:700;">(+${addedUnits})</span></div>` +
      (over ? `<div style="font-size:0.74rem;">Exceeds max by ${after - max} unit${after - max !== 1 ? 's' : ''}</div>` : '')
    : `<div style="font-size:0.66rem;letter-spacing:.06em;text-transform:uppercase;opacity:.75;">Current load</div>` +
      `<div style="font-size:1.05rem;font-weight:900;">${current} / ${max} units</div>` +
      `<div style="font-size:0.74rem;">Tick the section(s) to assign.</div>`;

  // Need at least one newly picked section (when the course has sections listed).
  btn.disabled = hasSections ? picked === 0 : false;
}

// ─────────────────────────────────────────────
//  FACULTY PREVIEW
// ─────────────────────────────────────────────
function showFacultyPreview(facultyId) {
  const preview = document.getElementById('facultyPreview');
  const btn = document.getElementById('confirmAssignBtn');
  const faculty = getFacultyById(facultyId);

  if (!faculty) {
    preview.style.display = 'none';
    btn.disabled = true;
    return;
  }

  preview.style.display = 'flex';
  preview.innerHTML = `
    <div class="faculty-preview__avatar">
      <img src="../assets/images/avatar-${escapeHtml(faculty.gender || 'female')}.svg" alt="${escapeHtml(faculty.name)}" />
    </div>
    <div>
      <p class="faculty-preview__name">${escapeHtml(faculty.name)}</p>
      <p class="faculty-preview__load">
        ${escapeHtml(faculty.dept)} · Current load: ${faculty.currentUnits || 0}/${faculty.maxUnits} units
      </p>
    </div>
  `;
  btn.disabled = false;
}

document.getElementById('facultySelect')?.addEventListener('change', e => {
  pickedSectionIds = new Set();
  showFacultyPreview(e.target.value);
  renderSections();
});

document.getElementById('sectionSelectAll')?.addEventListener('click', () => {
  const facultyId = currentFacultyId();
  (selectedCourse?.sections || []).forEach(sec => {
    if (Number(sec.assignedTo) !== facultyId) pickedSectionIds.add(sec.id);
  });
  renderSections();
});

// ─────────────────────────────────────────────
//  SAVE ASSIGNMENT TO DATABASE
// ─────────────────────────────────────────────
document.getElementById('confirmAssignBtn')?.addEventListener('click', async () => {
  const facultyId = document.getElementById('facultySelect').value;
  if (!facultyId || !selectedCourse) return;

  const course = selectedCourse;
  const faculty = getFacultyById(facultyId);
  const btn = document.getElementById('confirmAssignBtn');

  if (!faculty) return;

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const hasSections = (course.sections || []).length > 0;
    await API.assignCourseToFaculty(
      course.id, Number(facultyId),
      hasSections ? [...pickedSectionIds] : undefined
    );

    const n = pickedSectionIds.size;
    showToast(`✓ ${course.name}${hasSections ? ` (${n} section${n !== 1 ? 's' : ''})` : ''} assigned to ${faculty.name}`);
    await loadAssignmentData();

    selectedCourse = null;
    pickedSectionIds = new Set();
    document.getElementById('assignForm').style.display = 'none';
    document.getElementById('assignEmpty').style.display = 'flex';
  } catch (err) {
    showToast(`Failed to assign course: ${err.message}`, true);
  } finally {
    btn.textContent = 'Assign Course';
    if (selectedCourse) updateLoadSummary(); else btn.disabled = true;
  }
});

// ─────────────────────────────────────────────
//  CANCEL
// ─────────────────────────────────────────────
document.getElementById('cancelBtn')?.addEventListener('click', () => {
  selectedCourse = null;
  pickedSectionIds = new Set();
  document.getElementById('assignForm').style.display = 'none';
  document.getElementById('assignEmpty').style.display = 'flex';
  renderCourses();
});

// ─────────────────────────────────────────────
//  FILTERS + SEARCH
// ─────────────────────────────────────────────
document.querySelectorAll('#deptFilter .dept-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#deptFilter .dept-chip').forEach(c => c.classList.remove('dept-chip--active'));
    chip.classList.add('dept-chip--active');
    activeDept = chip.dataset.dept;
    renderCourses();
  });
});

document.querySelectorAll('#statusFilter .status-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#statusFilter .status-chip').forEach(c => c.classList.remove('dept-chip--active'));
    chip.classList.add('dept-chip--active');
    activeStatus = chip.dataset.status;
    renderCourses();
  });
});

document.getElementById('searchInput')?.addEventListener('input', e => {
  searchQuery = e.target.value;
  renderCourses();
});

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' toast--error' : '');
  void toast.offsetWidth;
  toast.classList.add('toast--show');
  setTimeout(() => toast.classList.remove('toast--show'), 3000);
}

// ─────────────────────────────────────────────
//  LOAD LIVE DATA
// ─────────────────────────────────────────────
async function loadAssignmentData() {
  const list = document.getElementById('coursesList');
  if (list) {
    list.innerHTML = '<p style="text-align:center;padding:32px;color:rgba(128,0,0,0.40);font-weight:600;font-size:0.88rem;">Loading courses...</p>';
  }

  try {
    const data = await API.getCourseAssignments();
    FACULTY = Array.isArray(data.faculty) ? data.faculty : [];
    COURSES = Array.isArray(data.courses) ? data.courses : [];

    updateStats();
    renderCourses();
  } catch (err) {
    console.error('[Assign Courses] Failed to load:', err);
    if (list) {
      list.innerHTML = `
        <p style="text-align:center;padding:32px;color:#a00000;font-weight:600;font-size:0.88rem;">
          Failed to load courses from the backend.<br>
          <small>${escapeHtml(err.message)}</small>
        </p>`;
    }
    document.getElementById('statUnassigned').textContent = '—';
    document.getElementById('statAssigned').textContent = '—';
    document.getElementById('statFaculty').textContent = '—';
  }
}

loadAssignmentData();
