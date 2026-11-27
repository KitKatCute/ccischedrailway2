'use strict';

// ── Current active tab ──
let activeTab = 'availability'; // 'availability' or 'preferredCourses'

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
//  TAB SWITCHING
// ─────────────────────────────────────────────
document.getElementById('availabilityTab')?.addEventListener('click', () => {
  activeTab = 'availability';
  updateActiveTab();
  loadSubmissions();
});

document.getElementById('preferredCoursesTab')?.addEventListener('click', () => {
  activeTab = 'preferredCourses';
  updateActiveTab();
  loadSubmissions();
});

function updateActiveTab() {
  document.querySelectorAll('.submission-tab').forEach(tab => {
    tab.classList.remove('submission-tab--active');
  });
  
  if (activeTab === 'availability') {
    document.getElementById('availabilityTab')?.classList.add('submission-tab--active');
  } else {
    document.getElementById('preferredCoursesTab')?.classList.add('submission-tab--active');
  }
}

// ─────────────────────────────────────────────
//  DATA — loaded from the real backend
// ─────────────────────────────────────────────
let facultySubmissions = [];

async function loadSubmissions() {
  try {
    const faculty = await API.getFacultyList().catch(() => []);
    const typeByFacultyId = {};
    faculty.forEach(f => { typeByFacultyId[f.id] = f.employment_type || 'Full Time'; });

    if (activeTab === 'availability') {
      // Load availability submissions
      const subsResult = await API.getAllSubmissions();
      facultySubmissions = (subsResult.submissions || []).map(s => ({
        id:            s.id,
        faculty_id:    s.faculty_id,
        faculty_name:  s.faculty_name || 'Unknown',
        type:          typeByFacultyId[s.faculty_id] || 'Faculty',
        status:        s.status,
        submittedDate: s.submitted_at
          ? new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null,
        submittedAtRaw: s.submitted_at,
        slotCount:     AvailabilityUtils.buildSlotCards(s.slots || [], { merge: true }).length,
        courses:       [],
      }));
    } else {
      // Load preferred courses submissions
      const coursesResult = await API.getAllPreferredCoursesSubmissions();
      facultySubmissions = (coursesResult.submissions || []).map(s => ({
        id:            s.id,
        faculty_id:    s.faculty_id,
        faculty_name:  s.faculty_name || 'Unknown',
        type:          typeByFacultyId[s.faculty_id] || 'Faculty',
        status:        s.status,
        submittedDate: s.submitted_at
          ? new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null,
        submittedAtRaw: s.submitted_at,
        slotCount:     0,
        courses:       s.courses || [],
      }));
    }

    renderColumnHeaders();
    renderStats();
    renderTable(activeFilter, searchQuery, sortBy);
  } catch (err) {
    console.error('[Submissions] Failed to load:', err);
  }
}

// ─────────────────────────────────────────────
//  COLUMN HEADERS (dynamic based on tab)
// ─────────────────────────────────────────────
function renderColumnHeaders() {
  const el = document.getElementById('csColHeaders');
  if (!el) return;

  if (activeTab === 'availability') {
    el.innerHTML = `
      <span class="cs-col cs-col--name">FACULTY NAME</span>
      <span class="cs-col cs-col--type">TYPE</span>
      <span class="cs-col cs-col--slots">SLOTS</span>
      <span class="cs-col cs-col--status">STATUS</span>
      <span class="cs-col cs-col--date">SUBMITTED</span>
      <span class="cs-col cs-col--actions">ACTIONS</span>
    `;
  } else {
    el.innerHTML = `
      <span class="cs-col cs-col--name">FACULTY NAME</span>
      <span class="cs-col cs-col--type">TYPE</span>
      <span class="cs-col cs-col--slots">COURSES</span>
      <span class="cs-col cs-col--status">STATUS</span>
      <span class="cs-col cs-col--date">SUBMITTED</span>
      <span class="cs-col cs-col--actions">ACTIONS</span>
    `;
  }
}

// ─────────────────────────────────────────────
//  SUMMARY CHIPS
// ─────────────────────────────────────────────
function renderStats() {
  const el = document.getElementById('csSummaryChips');
  if (!el) return;

  const total     = facultySubmissions.length;
  const submitted = facultySubmissions.filter(f => f.status === 'submitted').length;
  const approved  = facultySubmissions.filter(f => f.status === 'approved').length;
  const pending   = facultySubmissions.filter(f => f.status === 'pending').length;

  el.innerHTML = `
    <span class="cs-chip cs-chip--total">${total} Total</span>
    <span class="cs-chip cs-chip--submitted">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      ${submitted} Submitted
    </span>
    <span class="cs-chip cs-chip--approved">${approved} Approved</span>
    <span class="cs-chip cs-chip--pending">${pending} Pending</span>
  `;
}

// ─────────────────────────────────────────────
//  STATUS BADGE
// ─────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    approved:  `<span class="cs-status cs-status--approved">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Approved
                </span>`,
    submitted: `<span class="cs-status cs-status--submitted">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Submitted
                </span>`,
    returned:  `<span class="cs-status cs-status--returned">↑ Returned</span>`,
    rejected:  `<span class="cs-status cs-status--rejected">✗ Rejected</span>`,
    pending:   `<span class="cs-status cs-status--pending">⏳ Pending</span>`,
  };
  return map[status] || map.pending;
}

// ─────────────────────────────────────────────
//  GET INITIALS
// ─────────────────────────────────────────────
function initials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─────────────────────────────────────────────
//  PAGINATION VARIABLES
// ─────────────────────────────────────────────
const ITEMS_PER_PAGE = 5;
let currentPage = 1;
let filteredSubmissions = [];

// ─────────────────────────────────────────────
//  RENDER ROWS WITH PAGINATION
// ─────────────────────────────────────────────
function renderTable(filter = 'all', query = '', sort = 'name') {
  const body    = document.getElementById('csBody');
  const countEl = document.getElementById('csCount');
  if (!body) return;

  const q = query.trim().toLowerCase();

  filteredSubmissions = facultySubmissions.filter(f => {
    const matchStatus = filter === 'all' || f.status === filter;
    const matchQuery  = !q || f.faculty_name.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  filteredSubmissions = filteredSubmissions.slice().sort((a, b) => {
    if (sort === 'date') {
      if (!a.submittedAtRaw && !b.submittedAtRaw) return a.faculty_name.localeCompare(b.faculty_name);
      if (!a.submittedAtRaw) return 1;
      if (!b.submittedAtRaw) return -1;
      return new Date(b.submittedAtRaw) - new Date(a.submittedAtRaw);
    }
    return a.faculty_name.localeCompare(b.faculty_name);
  });

  // Reset to page 1 when filtering/sorting changes
  currentPage = 1;

  if (countEl) countEl.textContent = `${filteredSubmissions.length} faculty`;

  if (!filteredSubmissions.length) {
    body.innerHTML = `<div class="cs-empty"><p>No submissions match the current filter.</p></div>`;
    renderPagination();
    return;
  }

  // Paginate
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageData = filteredSubmissions.slice(startIndex, endIndex);

  body.innerHTML = pageData.map(f => `
    <div class="cs-row">
      <div class="cs-row__name">
        <div class="cs-row__avatar">${initials(f.faculty_name)}</div>
        <div><p class="cs-row__name-text">${f.faculty_name}</p></div>
      </div>
      <span class="cs-row__type">${f.type}</span>
      <div class="cs-row__slots">
        <span class="cs-slot-count ${f.slotCount === 0 ? 'cs-slot-count--zero' : ''}">${f.slotCount}</span>
      </div>
      <div class="cs-row__status">${statusBadge(f.status)}</div>
      <span class="cs-row__date">${f.submittedDate || '—'}</span>
      <div class="cs-row__actions">
        <button class="cs-view-btn" data-view="${f.id}" title="View details">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          View
        </button>
        <button class="cs-delete-btn" data-delete="${f.id}" data-name="${f.faculty_name}" title="Delete submission">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M6 4V2.7a.7.7 0 01.7-.7h2.6a.7.7 0 01.7.7V4M12.3 4l-.6 9.3a1 1 0 01-1 .9H5.3a1 1 0 01-1-.9L3.7 4"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  body.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const submissionId = parseInt(btn.dataset.view);
      if (activeTab === 'preferredCourses') {
        viewPreferredCourses(submissionId);
      } else {
        window.location.href = `submission-detail.html?id=${submissionId}`;
      }
    });
  });

  body.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.delete, btn.dataset.name));
  });

  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE);
  const startItem = filteredSubmissions.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredSubmissions.length);
  
  const startEl = document.getElementById('csPaginationStart');
  const endEl = document.getElementById('csPaginationEnd');
  const totalEl = document.getElementById('csPaginationTotal');
  
  if (startEl) startEl.textContent = startItem;
  if (endEl) endEl.textContent = endItem;
  if (totalEl) totalEl.textContent = filteredSubmissions.length;
  
  const prevBtn = document.getElementById('csPrevPage');
  const nextBtn = document.getElementById('csNextPage');
  
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
  
  const pagesContainer = document.getElementById('csPaginationPages');
  if (!pagesContainer) return;
  
  pagesContainer.innerHTML = '';
  
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pagesContainer.appendChild(createPageButton(i));
    }
  } else {
    pagesContainer.appendChild(createPageButton(1));
    
    if (currentPage > 3) {
      pagesContainer.appendChild(createEllipsis());
    }
    
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);
    
    if (currentPage <= 3) endPage = 4;
    if (currentPage >= totalPages - 2) startPage = totalPages - 3;
    
    for (let i = startPage; i <= endPage; i++) {
      pagesContainer.appendChild(createPageButton(i));
    }
    
    if (currentPage < totalPages - 2) {
      pagesContainer.appendChild(createEllipsis());
    }
    
    pagesContainer.appendChild(createPageButton(totalPages));
  }
}

function createPageButton(pageNum) {
  const btn = document.createElement('button');
  btn.className = `cs-pagination__page ${pageNum === currentPage ? 'cs-pagination__page--active' : ''}`;
  btn.textContent = pageNum;
  btn.addEventListener('click', () => {
    currentPage = pageNum;
    renderTableCurrentPage();
  });
  return btn;
}

function createEllipsis() {
  const span = document.createElement('span');
  span.className = 'cs-pagination__ellipsis';
  span.textContent = '...';
  return span;
}

function renderTableCurrentPage() {
  const body = document.getElementById('csBody');
  if (!body) return;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageData = filteredSubmissions.slice(startIndex, endIndex);

  body.innerHTML = pageData.map(f => `
    <div class="cs-row">
      <div class="cs-row__name">
        <div class="cs-row__avatar">${initials(f.faculty_name)}</div>
        <div><p class="cs-row__name-text">${f.faculty_name}</p></div>
      </div>
      <span class="cs-row__type">${f.type}</span>
      <div class="cs-row__slots">
        <span class="cs-slot-count ${f.slotCount === 0 ? 'cs-slot-count--zero' : ''}">${f.slotCount}</span>
      </div>
      <div class="cs-row__status">${statusBadge(f.status)}</div>
      <span class="cs-row__date">${f.submittedDate || '—'}</span>
      <div class="cs-row__actions">
        <button class="cs-view-btn" data-view="${f.id}" title="View details">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          View
        </button>
        <button class="cs-delete-btn" data-delete="${f.id}" data-name="${f.faculty_name}" title="Delete submission">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M6 4V2.7a.7.7 0 01.7-.7h2.6a.7.7 0 01.7.7V4M12.3 4l-.6 9.3a1 1 0 01-1 .9H5.3a1 1 0 01-1-.9L3.7 4"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  body.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const submissionId = parseInt(btn.dataset.view);
      if (activeTab === 'preferredCourses') {
        viewPreferredCourses(submissionId);
      } else {
        window.location.href = `submission-detail.html?id=${submissionId}`;
      }
    });
  });

  body.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.delete, btn.dataset.name));
  });

  renderPagination();
}

async function handleDelete(submissionId, name) {
  if (!confirm(`Delete ${name}'s availability submission? This cannot be undone.`)) return;

  try {
    await API.deleteSubmission(submissionId);
    facultySubmissions = facultySubmissions.filter(f => String(f.id) !== String(submissionId));
    renderStats();
    renderTable(activeFilter, searchQuery, sortBy);
    showToast(`${name}'s submission deleted.`);
  } catch (err) {
    showToast('Failed to delete submission: ' + err.message);
  }
}

// ─────────────────────────────────────────────
//  FILTER + SEARCH + SORT
// ─────────────────────────────────────────────
let activeFilter = 'all';
let searchQuery  = '';
let sortBy       = 'name';

document.getElementById('statusFilter')?.addEventListener('change', function () {
  activeFilter = this.value;
  renderTable(activeFilter, searchQuery, sortBy);
});

document.getElementById('sortBy')?.addEventListener('change', function () {
  sortBy = this.value;
  renderTable(activeFilter, searchQuery, sortBy);
});

document.getElementById('searchInput')?.addEventListener('input', function () {
  searchQuery = this.value;
  renderTable(activeFilter, searchQuery, sortBy);
});

// ─────────────────────────────────────────────
//  PAGINATION CONTROLS
// ─────────────────────────────────────────────
document.getElementById('csPrevPage')?.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderTableCurrentPage();
  }
});

document.getElementById('csNextPage')?.addEventListener('click', () => {
  const totalPages = Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    renderTableCurrentPage();
  }
});

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastEl, toastTimer;

function showToast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'cs-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('cs-toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('cs-toast--show'), 2800);
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
loadSubmissions();


// ─────────────────────────────────────────────
//  PREFERRED COURSES MODAL
// ─────────────────────────────────────────────
let currentPreferredSubmission = null;
let allCoursesCache = null;

async function viewPreferredCourses(submissionId) {
  const submission = facultySubmissions.find(s => s.id === submissionId);
  if (!submission) return;

  currentPreferredSubmission = submission;
  
  // Load all courses to get titles (cache for performance)
  if (!allCoursesCache) {
    allCoursesCache = await API.getCourses().catch(() => []);
  }
  
  const courseMap = {};
  allCoursesCache.forEach(c => { courseMap[c.id] = c; });

  // Show modal
  const modal = document.getElementById('preferredCoursesModal');
  const modalName = document.getElementById('modalFacultyName');
  const modalList = document.getElementById('modalCoursesList');
  
  modalName.textContent = `${submission.faculty_name} - Preferred Courses`;
  
  if (!submission.courses || submission.courses.length === 0) {
    modalList.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem; background: #f9f9f9; border-radius: 6px; border: 1px dashed #ddd;">No courses submitted yet.</p>';
  } else {
    const sorted = [...submission.courses].sort((a, b) => a.preference_rank - b.preference_rank);
    modalList.innerHTML = sorted.map((item, index) => {
      const course = courseMap[item.course_id];
      const courseCode = item.course_code || course?.code || 'N/A';
      const courseTitle = course?.title || 'Unknown Course';
      
      return `
        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; background: #fff; border-radius: 8px; border: 1.5px solid #e0e0e0; transition: box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
          <div style="display: flex; align-items: center; justify-content: center; min-width: 40px; height: 40px; background: #800000; color: white; border-radius: 50%; font-weight: 700; font-size: 1rem; flex-shrink: 0;">
            ${index + 1}
          </div>
          <div style="flex: 1; min-width: 0;">
            <p style="font-weight: 600; font-size: 0.95rem; color: #333; margin: 0 0 0.25rem 0;">${courseCode}</p>
            <p style="font-size: 0.85rem; color: #666; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${courseTitle}</p>
          </div>
          <div style="text-align: right; padding: 0.5rem 0.75rem; background: #f5f5f5; border-radius: 6px; border: 1px solid #ddd;">
            <p style="font-size: 0.7rem; color: #999; margin: 0 0 0.15rem 0; text-transform: uppercase; letter-spacing: 0.5px;">Rank</p>
            <p style="font-size: 1rem; font-weight: 700; color: #800000; margin: 0;">#${item.preference_rank}</p>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // Update button states based on current status
  const approveBtn = document.getElementById('approvePreferredBtn');
  const rejectBtn = document.getElementById('rejectPreferredBtn');
  
  if (submission.status === 'approved') {
    approveBtn.disabled = true;
    approveBtn.style.opacity = '0.5';
    approveBtn.style.cursor = 'not-allowed';
    approveBtn.title = 'Already approved';
  } else {
    approveBtn.disabled = false;
    approveBtn.style.opacity = '1';
    approveBtn.style.cursor = 'pointer';
    approveBtn.title = '';
  }
  
  if (submission.status === 'rejected') {
    rejectBtn.disabled = true;
    rejectBtn.style.opacity = '0.5';
    rejectBtn.style.cursor = 'not-allowed';
    rejectBtn.title = 'Already rejected';
  } else {
    rejectBtn.disabled = false;
    rejectBtn.style.opacity = '1';
    rejectBtn.style.cursor = 'pointer';
    rejectBtn.title = '';
  }
  
  modal.style.display = 'flex';
}

function closePreferredCoursesModal() {
  document.getElementById('preferredCoursesModal').style.display = 'none';
  currentPreferredSubmission = null;
}

async function approvePreferredCourses() {
  if (!currentPreferredSubmission) return;
  if (currentPreferredSubmission.status === 'approved') return;
  
  if (!confirm(`Approve ${currentPreferredSubmission.faculty_name}'s preferred courses?`)) return;
  
  try {
    await API.updatePreferredCoursesStatus(currentPreferredSubmission.id, 'approved');
    alert('✓ Preferred courses approved successfully!');
    closePreferredCoursesModal();
    loadSubmissions(); // Reload the list
  } catch (err) {
    console.error('Failed to approve:', err);
    alert(err.message || 'Failed to approve. Please try again.');
  }
}

async function rejectPreferredCourses() {
  if (!currentPreferredSubmission) return;
  if (currentPreferredSubmission.status === 'rejected') return;
  
  if (!confirm(`Reject ${currentPreferredSubmission.faculty_name}'s preferred courses?`)) return;
  
  try {
    await API.updatePreferredCoursesStatus(currentPreferredSubmission.id, 'rejected');
    alert('✗ Preferred courses rejected.');
    closePreferredCoursesModal();
    loadSubmissions(); // Reload the list
  } catch (err) {
    console.error('Failed to reject:', err);
    alert(err.message || 'Failed to reject. Please try again.');
  }
}

// Make functions global for onclick handlers
window.viewPreferredCourses = viewPreferredCourses;
window.closePreferredCoursesModal = closePreferredCoursesModal;
window.approvePreferredCourses = approvePreferredCourses;
window.rejectPreferredCourses = rejectPreferredCourses;
