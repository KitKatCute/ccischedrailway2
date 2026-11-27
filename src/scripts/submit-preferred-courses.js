'use strict';

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let allCourses = [];
let selectedCourses = [];
let submissionData = null;

// ─────────────────────────────────────────────
//  TRACK FILTERING (IT / CS / general)
// ─────────────────────────────────────────────
function facultyTrack(department) {
  const d = String(department || '').toLowerCase();
  if (d === 'cs' || d.includes('computer science')) return 'CS';
  if (d === 'it' || d.includes('information technology')) return 'IT';
  return null; // unknown department -> not restricted
}

function courseAllowedForTrack(course, track) {
  const prog = String(course.program || '').trim().toUpperCase();
  if (prog !== 'IT' && prog !== 'CS') return true; // general / service subject
  return !track || prog === track;
}

// ─────────────────────────────────────────────
//  LOAD DATA
// ─────────────────────────────────────────────
async function loadData() {
  try {
    // Load all courses
    const coursesData = await API.getCourses();
    // Backend returns array directly, not wrapped in {courses: [...]}
    const everyCourse = Array.isArray(coursesData) ? coursesData : [];

    // IT faculty only see IT + general subjects; CS faculty only see CS + general subjects.
    const me = await API.getCurrentUser();
    const track = facultyTrack(me?.user?.department);
    allCourses = everyCourse.filter(c => courseAllowedForTrack(c, track));

    // Load existing submission
    submissionData = await API.getMyPreferredCourses();
    
    // If there's an existing submission, load the courses
    if (submissionData.courses && submissionData.courses.length > 0) {
      const allowedIds = new Set(allCourses.map(c => c.id));
      selectedCourses = submissionData.courses
        .filter(c => allowedIds.has(c.course_id))
        .map((c, i) => ({
          course_id: c.course_id,
          course_code: c.course_code,
          preference_rank: i + 1
        }));
    }

    // Update UI
    updateStatusBadge();
    renderCourseDropdown();
    renderSelectedCourses();
  } catch (err) {
    console.error('Failed to load data:', err);
    alert('Failed to load course data. Please refresh the page.');
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
  }
}

function renderCourseDropdown() {
  const select = document.getElementById('courseSelect');
  if (!select) return;

  // Filter out already selected courses
  const selectedIds = new Set(selectedCourses.map(c => c.course_id));
  const availableCourses = allCourses.filter(c => !selectedIds.has(c.id));

  select.innerHTML = '<option value="">-- Select a course --</option>';
  availableCourses.forEach(course => {
    const option = document.createElement('option');
    option.value = course.id;
    option.textContent = `${course.code} - ${course.title}`;
    select.appendChild(option);
  });
}

function renderSelectedCourses() {
  const container = document.getElementById('selectedCoursesList');
  if (!container) return;

  if (selectedCourses.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: #999; font-size: 0.85rem; padding: 2rem;">
        No courses selected yet. Add courses from the dropdown above.
      </p>`;
    return;
  }

  // Sort by preference rank
  const sorted = [...selectedCourses].sort((a, b) => a.preference_rank - b.preference_rank);

  container.innerHTML = sorted.map((item, index) => {
    const course = allCourses.find(c => c.id === item.course_id);
    if (!course) return '';

    return `
      <div class="course-item" data-course-id="${item.course_id}" draggable="true" 
           style="display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; 
                  background: #fff; border: 1.5px solid #e0e0e0; border-radius: 8px; 
                  transition: all 0.2s ease; cursor: move;">
        <div class="drag-handle" style="display: flex; align-items: center; color: #bbb; margin-right: 0.25rem;">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="6" cy="4" r="1.2" fill="currentColor"/>
            <circle cx="10" cy="4" r="1.2" fill="currentColor"/>
            <circle cx="6" cy="8" r="1.2" fill="currentColor"/>
            <circle cx="10" cy="8" r="1.2" fill="currentColor"/>
            <circle cx="6" cy="12" r="1.2" fill="currentColor"/>
            <circle cx="10" cy="12" r="1.2" fill="currentColor"/>
          </svg>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; 
                    min-width: 40px; height: 40px; background: #800000; color: white; 
                    border-radius: 50%; font-weight: 700; font-size: 1rem; flex-shrink: 0;">
          ${index + 1}
        </div>
        <div style="flex: 1; min-width: 0;">
          <p style="font-weight: 600; font-size: 0.95rem; color: #333; margin: 0 0 0.25rem 0;">
            ${course.code}
          </p>
          <p style="font-size: 0.85rem; color: #666; margin: 0; white-space: nowrap; 
                    overflow: hidden; text-overflow: ellipsis;">
            ${course.title}
          </p>
        </div>
        <button class="remove-course-btn" data-course-id="${item.course_id}" 
                style="background: #d32f2f; color: white; border: none; 
                       padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; 
                       font-family: 'Raleway', sans-serif; font-size: 0.8rem; 
                       font-weight: 600; flex-shrink: 0; transition: background 0.2s ease;"
                onmouseover="this.style.background='#b71c1c'" 
                onmouseout="this.style.background='#d32f2f'">
          Remove
        </button>
      </div>
    `;
  }).join('');

  // Add drag and drop listeners
  attachDragListeners();

  // Add remove button listeners
  container.querySelectorAll('.remove-course-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const courseId = parseInt(btn.dataset.courseId);
      removeCourse(courseId);
    });
  });
}

// ─────────────────────────────────────────────
//  DRAG AND DROP
// ─────────────────────────────────────────────
function attachDragListeners() {
  const items = document.querySelectorAll('.course-item');
  items.forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
  });
}

let draggedItem = null;

function handleDragStart(e) {
  draggedItem = this;
  e.dataTransfer.effectAllowed = 'move';
  this.style.opacity = '0.4';
  this.style.transform = 'scale(0.98)';
  this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  if (this !== draggedItem) {
    const container = document.getElementById('selectedCoursesList');
    const items = [...container.querySelectorAll('.course-item')];
    const draggedIndex = items.indexOf(draggedItem);
    const targetIndex = items.indexOf(this);
    
    if (draggedIndex < targetIndex) {
      this.parentNode.insertBefore(draggedItem, this.nextSibling);
    } else {
      this.parentNode.insertBefore(draggedItem, this);
    }
  }
}

function handleDrop(e) {
  e.stopPropagation();
  return false;
}

function handleDragEnd() {
  this.style.opacity = '';
  this.style.transform = '';
  this.style.boxShadow = '';
  
  // Update preference ranks based on new order
  const container = document.getElementById('selectedCoursesList');
  const items = [...container.querySelectorAll('.course-item')];
  
  items.forEach((item, index) => {
    const courseId = parseInt(item.dataset.courseId);
    const course = selectedCourses.find(c => c.course_id === courseId);
    if (course) {
      course.preference_rank = index + 1;
    }
  });

  renderSelectedCourses();
}

// ─────────────────────────────────────────────
//  ACTIONS
// ─────────────────────────────────────────────
function addCourse() {
  const select = document.getElementById('courseSelect');
  const courseId = parseInt(select.value);
  
  if (!courseId) {
    alert('Please select a course from the dropdown.');
    return;
  }

  const course = allCourses.find(c => c.id === courseId);
  if (!course) return;

  // Add to selected courses with the next rank
  const nextRank = selectedCourses.length + 1;
  selectedCourses.push({
    course_id: courseId,
    course_code: course.code,
    preference_rank: nextRank
  });

  // Reset dropdown
  select.value = '';

  renderCourseDropdown();
  renderSelectedCourses();
}

function removeCourse(courseId) {
  selectedCourses = selectedCourses.filter(c => c.course_id !== courseId);
  
  // Re-index preference ranks
  selectedCourses.forEach((c, index) => {
    c.preference_rank = index + 1;
  });

  renderCourseDropdown();
  renderSelectedCourses();
}

async function submitPreferredCourses() {
  if (selectedCourses.length === 0) {
    alert('Please add at least one preferred course before submitting.');
    return;
  }

  if (!confirm('Submit your preferred courses? The chairperson will be notified.')) {
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    // Save courses first
    await API.savePreferredCourses(selectedCourses);
    
    // Then finalize
    await API.finalizePreferredCourses();

    alert('Your preferred courses have been submitted successfully!');
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Failed to submit preferred courses:', err);
    alert(err.message || 'Failed to submit. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
  }
}

// ─────────────────────────────────────────────
//  EVENT LISTENERS
// ─────────────────────────────────────────────
document.getElementById('addCourseBtn')?.addEventListener('click', addCourse);
document.getElementById('submitBtn')?.addEventListener('click', submitPreferredCourses);

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
(async function init() {
  await loadData();
})();
