'use strict';

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let submissionData = null;
let allCourses = [];

// ─────────────────────────────────────────────
//  LOAD DATA
// ─────────────────────────────────────────────
async function loadData() {
  try {
    // Load submission
    submissionData = await API.getMyPreferredCourses();
    
    // Load all courses
    const coursesData = await API.getCourses();
    // Backend returns array directly, not wrapped in {courses: [...]}
    allCourses = Array.isArray(coursesData) ? coursesData : [];

    // Update UI
    updateStatusBadge();
    updateSemesterInfo();
    renderCoursesList();
  } catch (err) {
    console.error('Failed to load data:', err);
    alert('Failed to load your submission. Please refresh the page.');
  }
}

// ─────────────────────────────────────────────
//  UI RENDERING
// ─────────────────────────────────────────────
function updateStatusBadge() {
  const badge = document.getElementById('statusBadge');
  if (!badge) return;

  const sub = submissionData?.submission;
  if (!sub || sub.status === 'pending') {
    badge.className = 'af-card__slot-badge';
    badge.style.background = '#FFB81C';
    badge.textContent = 'PENDING';
  } else if (sub.status === 'submitted') {
    badge.className = 'af-card__slot-badge';
    badge.style.background = '#2E7D32';
    badge.textContent = 'SUBMITTED';
  } else if (sub.status === 'approved') {
    badge.className = 'af-card__slot-badge';
    badge.style.background = '#2E7D32';
    badge.textContent = 'APPROVED';
  } else if (sub.status === 'rejected') {
    badge.className = 'af-card__slot-badge';
    badge.style.background = '#d32f2f';
    badge.textContent = 'REJECTED';
  }
}

function updateSemesterInfo() {
  const semesterEl = document.getElementById('semesterInfo');
  const submittedEl = document.getElementById('submittedInfo');
  
  const sem = submissionData?.semester;
  const sub = submissionData?.submission;

  if (semesterEl && sem) {
    semesterEl.textContent = `${sem.semester_term} Semester AY ${sem.academic_year}`;
  }

  if (submittedEl && sub && sub.submitted_at) {
    const date = new Date(sub.submitted_at);
    submittedEl.textContent = date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } else if (submittedEl) {
    submittedEl.textContent = 'Not yet submitted';
  }
}

function renderCoursesList() {
  const container = document.getElementById('coursesList');
  if (!container) return;

  const courses = submissionData?.courses || [];

  if (courses.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: #999; font-size: 0.85rem; padding: 2rem;">
        No preferred courses submitted yet.
      </p>`;
    return;
  }

  // Sort by preference rank
  const sorted = [...courses].sort((a, b) => a.preference_rank - b.preference_rank);

  container.innerHTML = sorted.map((item, index) => {
    const course = allCourses.find(c => c.id === item.course_id);
    const courseCode = item.course_code || course?.code || 'N/A';
    const courseTitle = course?.title || 'Unknown Course';

    return `
      <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; 
                  background: #f9f9f9; border-radius: 8px; border: 1.5px solid #e0e0e0;">
        <div style="display: flex; align-items: center; justify-content: center; 
                    min-width: 40px; height: 40px; background: #800000; color: white; 
                    border-radius: 50%; font-weight: 700; font-size: 1rem; flex-shrink: 0;">
          ${index + 1}
        </div>
        <div style="flex: 1; min-width: 0;">
          <p style="font-weight: 600; font-size: 0.95rem; color: #333; margin: 0 0 0.25rem 0;">
            ${courseCode}
          </p>
          <p style="font-size: 0.85rem; color: #666; margin: 0; white-space: nowrap; 
                    overflow: hidden; text-overflow: ellipsis;">
            ${courseTitle}
          </p>
        </div>
        <div style="text-align: right; padding: 0.5rem 0.75rem; background: #fff; 
                    border-radius: 6px; border: 1px solid #ddd;">
          <p style="font-size: 0.7rem; color: #999; margin: 0 0 0.15rem 0; text-transform: uppercase; 
                    letter-spacing: 0.5px;">Preference</p>
          <p style="font-size: 1rem; font-weight: 700; color: #800000; margin: 0;">
            #${item.preference_rank}
          </p>
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
(async function init() {
  await loadData();
})();
