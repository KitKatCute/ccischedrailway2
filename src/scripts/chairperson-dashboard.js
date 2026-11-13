'use strict';

// ── Topbar date ──
const topbarDate = document.getElementById('topbarDate');
if (topbarDate) {
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const datePart = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  topbarDate.textContent = `${dayName}, ${datePart}`;
}

// ── Display the logged-in chairperson's name/role (was previously never
//    wired up at all — the banner and profile panel just showed static
//    placeholder text regardless of who logged in) ──
function applyCurrentUserToPage(user) {
  if (!user) return;
  const fullName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ');

  const greetingStrong = document.querySelector('.welcome-banner__greeting strong');
  if (greetingStrong) greetingStrong.textContent = fullName;

  const panelName = document.querySelector('.cp-profile__name');
  if (panelName) panelName.textContent = fullName;

  const panelRole = document.querySelector('.cp-profile__role');
  if (panelRole) panelRole.textContent = 'Chairperson';
}

document.addEventListener('authReady', (e) => applyCurrentUserToPage(e.detail));
if (typeof currentUser !== 'undefined' && currentUser) applyCurrentUserToPage(currentUser);

// ── Notification bell ──
document.getElementById('notifBtn')?.addEventListener('click', () => {
  window.location.href = 'notifications.html';
});

// ─────────────────────────────────────────────
//  DONUT CHART HELPER
//  circumference = 2π × r = 2π × 38 ≈ 238.76
// ─────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 38; // ≈ 238.76

/**
 * Animate a donut arc to a given percentage.
 * @param {string} fillId  — id of the <circle> fill element
 * @param {string} labelId — id of the label <span>
 * @param {number} pct     — 0–100
 */
function animateDonut(fillId, labelId, pct) {
  const fill  = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if (!fill || !label) return;

  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  // Color tier: low=green, mid=yellow, full/high=maroon
  fill.classList.remove('donut-fill--green', 'donut-fill--yellow', 'donut-fill--maroon');
  if (pct === 0)       { /* no class — default grey */ }
  else if (pct >= 100) fill.classList.add('donut-fill--maroon');
  else if (pct >= 50)  fill.classList.add('donut-fill--yellow');
  else                 fill.classList.add('donut-fill--green');

  // Apply matching color to the label too
  const labelEl = document.getElementById(labelId);
  if (labelEl) {
    labelEl.classList.remove('donut-label--green', 'donut-label--yellow', 'donut-label--maroon');
    if (pct >= 100)     labelEl.classList.add('donut-label--maroon');
    else if (pct >= 50) labelEl.classList.add('donut-label--yellow');
    else if (pct > 0)   labelEl.classList.add('donut-label--green');
  }

  // Trigger CSS transition by setting after a short delay (allows paint first)
  requestAnimationFrame(() => {
    fill.style.strokeDashoffset = offset;
    label.textContent = pct + '%';
  });
}

// ─────────────────────────────────────────────
//  ACTIVE SEMESTER SWITCH
//  Exactly one semester is active; everything else in the system (course
//  offerings, coverage, generation, availability) follows it.
// ─────────────────────────────────────────────
function semesterLabel(s) {
  return `AY ${s.academic_year} · ${s.semester_term}`;
}

function renderSemesterSwitch(semesters, activeSem) {
  const banner = document.getElementById('bannerSub');
  if (banner) {
    banner.textContent = activeSem
      ? `${semesterLabel(activeSem)} · Here's your dashboard overview.`
      : "No active semester set · Here's your dashboard overview.";
  }

  const select = document.getElementById('semesterSwitch');
  if (!select) return;

  select.innerHTML = '';
  if (!activeSem) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Select a semester…';
    select.appendChild(opt);
  }
  // Newest first (API already sorts by id desc)
  semesters.forEach(sem => {
    const opt = document.createElement('option');
    opt.value = sem.id;
    opt.textContent = semesterLabel(sem) + (sem.is_active ? '  (active)' : '');
    if (sem.is_active) opt.selected = true;
    select.appendChild(opt);
  });
  select.dataset.current = activeSem ? String(activeSem.id) : '';

  if (!select.dataset.bound) {
    select.dataset.bound = '1';
    select.addEventListener('change', async () => {
      const id  = select.value;
      const sem = semesters.find(s => String(s.id) === id);
      if (!id || !sem) return;

      const ok = window.confirm(
        `Switch the active semester to ${semesterLabel(sem)}?\n\n` +
        `Course offerings, section coverage, faculty assignment and ` +
        `availability will all follow this semester.`
      );
      if (!ok) { select.value = select.dataset.current; return; }

      select.disabled = true;
      try {
        const res = await API.setActiveSemester(Number(id));
        // Tell the chairperson when the term's courses were auto-offered
        if (res?.offering?.created) alert(res.message);
        window.location.reload();
      } catch (err) {
        select.disabled = false;
        select.value = select.dataset.current;
        alert(`Could not switch semester: ${err.message}`);
      }
    });
  }
}

// ─────────────────────────────────────────────
//  DASHBOARD DATA — loaded live from the real backend
// ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [rooms, faculty, semesters, submissions, coverage] = await Promise.all([
      API.getRooms(),
      API.getFacultyList(),
      API.getSemesters(),
      API.getAllSubmissions(),
      API.getCoverage(),
    ]);

    // ── Room Availability ──
    const lectureCount = rooms.filter(r => r.room_type === 'Lecture').length;
    const labCount      = rooms.filter(r => r.room_type === 'Laboratory').length;
    const lectureCountEl = document.getElementById('lectureCount');
    const labCountEl      = document.getElementById('labCount');
    if (lectureCountEl) lectureCountEl.textContent = lectureCount;
    if (labCountEl)      labCountEl.textContent = labCount;

    // ── Active semester ──
    const activeSem = semesters.find(s => s.is_active);
    renderSemesterSwitch(semesters, activeSem);
    const statSemesterEl = document.getElementById('statSemesterTerm');
    if (statSemesterEl) statSemesterEl.textContent = activeSem ? activeSem.semester_term : '—';

    // ── Faculty count ──
    const statFacultyEl = document.getElementById('statFacultyCount');
    if (statFacultyEl) statFacultyEl.textContent = faculty.length;

    // ── Availability: "submitted" = anyone who has finalized at least once
    //    (submitted/approved/rejected/returned all imply they turned it in);
    //    "pending" = everyone else, including faculty who haven't started
    //    at all (no submission row exists for them yet) ──
    const c = submissions.counts || { submitted: 0, approved: 0, rejected: 0, returned: 0 };
    const submittedCount = (c.submitted || 0) + (c.approved || 0) + (c.rejected || 0) + (c.returned || 0);
    const pendingCount   = Math.max(faculty.length - submittedCount, 0);
    const availabilityPct = faculty.length > 0 ? Math.round((submittedCount / faculty.length) * 100) : 0;

    const statPendingEl = document.getElementById('statPendingCount');
    if (statPendingEl) statPendingEl.textContent = pendingCount;

    // ── Section coverage ──
    const { total_sections, sections_covered } = coverage.totals;
    const coveragePct = total_sections > 0 ? Math.round((sections_covered / total_sections) * 100) : 0;

    // ── Donuts ──
    setTimeout(() => {
      animateDonut('donutBSITFill', 'donutBSITLabel', coveragePct);
      animateDonut('donutBSCSFill', 'donutBSCSLabel', availabilityPct);
    }, 120);

    // ── Quick Overview ──
    const overviewCoverage    = document.getElementById('overviewCoverage');
    const overviewAvailability = document.getElementById('overviewAvailability');
    const overviewUnassigned  = document.getElementById('overviewUnassigned');

    // Helper: pick tier color based on pct (low=green, mid=amber, high=maroon)
    function tierColor(pct) {
      const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      if (pct >= 100) return { dot: v('--cp-od-high'), text: v('--cp-od-high-tx') };
      if (pct >= 50)  return { dot: v('--cp-od-mid'),  text: v('--cp-od-mid-tx')  };
      if (pct > 0)    return { dot: v('--cp-od-low'),  text: v('--cp-od-low-tx')  };
      return { dot: 'rgba(255,255,255,0.30)', text: 'rgba(255,255,255,0.55)' };
    }

    function applyOverviewTier(dotId, valueEl, pct) {
      const c = tierColor(pct);
      const dot = document.getElementById(dotId);
      if (dot)     dot.style.background = c.dot;
      if (valueEl) valueEl.style.color   = c.text;
    }

    if (overviewCoverage)     overviewCoverage.textContent = `${coveragePct}% Complete`;
    if (overviewAvailability) overviewAvailability.textContent = `${availabilityPct}% Complete`;

    applyOverviewTier('dotCoverage',     overviewCoverage,     coveragePct);
    applyOverviewTier('dotAvailability', overviewAvailability, availabilityPct);

    // ── Unassigned sections (flatten every uncovered section across courses) ──
    const unassigned = [];
    const bySection  = {};   // section label -> number of unassigned courses
    coverage.courses.forEach(course => {
      course.sections.forEach(sec => {
        if (!sec.assignedTo) {
          unassigned.push(`${course.code}: ${course.name} (${sec.label})`);
          bySection[sec.label] = (bySection[sec.label] || 0) + 1;
        }
      });
    });
    if (overviewUnassigned) overviewUnassigned.textContent = `${unassigned.length} Section${unassigned.length === 1 ? '' : 's'}`;

    // ── Faculty Availability bar chart ──
    const barChart = document.getElementById('availBarChart');
    if (barChart) {
      barChart.innerHTML = '';
      const maxVal = Math.max(submittedCount, pendingCount, 1);
      [submittedCount, pendingCount].forEach((val, idx) => {
        const col = document.createElement('div');
        col.className = 'cp-bar-col';

        const bar = document.createElement('div');
        bar.className = 'cp-bar';
        // Color tier on submitted bar (idx=0) based on submission rate
        if (idx === 0) {
          const ratio = faculty.length > 0 ? (submittedCount / faculty.length) * 100 : 0;
          if (ratio >= 100)     bar.classList.add('cp-bar--maroon');
          else if (ratio >= 50) bar.classList.add('cp-bar--yellow');
          else if (ratio > 0)   bar.classList.add('cp-bar--green');
        }
        bar.style.height = '2%';
        bar.setAttribute('title', (idx === 0 ? 'Submitted' : 'Pending') + ': ' + val);

        const num = document.createElement('span');
        num.className = 'cp-bar__val';
        num.textContent = val;
        bar.appendChild(num);

        col.appendChild(bar);
        barChart.appendChild(col);
        setTimeout(() => {
          bar.style.height = Math.max(Math.round((val / maxVal) * 100), 2) + '%';
        }, 150 + idx * 80);
      });
    }

    // ── Unassigned Courses metric graph: unassigned courses per section ──
    const barsEl   = document.getElementById('unassignedBars');
    const topName  = document.getElementById('topSectionName');
    const topCount = document.getElementById('topSectionCount');
    const topUnit  = document.getElementById('topSectionUnit');
    if (barsEl) {
      barsEl.innerHTML = '';
      const ranked = Object.entries(bySection).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
      if (ranked.length === 0) {
        if (topName)  topName.textContent  = 'All covered';
        if (topCount) topCount.textContent = '0';
        if (topUnit)  topUnit.textContent  = 'courses unassigned';
      } else {
        const [topLabel, topVal] = ranked[0];
        if (topName)  topName.textContent  = topLabel;
        if (topCount) topCount.textContent = topVal;
        if (topUnit)  topUnit.textContent  = topVal === 1 ? 'course unassigned' : 'courses unassigned';

        const MAX_BARS = 6;
        ranked.slice(0, MAX_BARS).forEach(([label, val], idx) => {
          const row = document.createElement('div');
          row.className = 'cp-hbar' + (idx === 0 ? ' cp-hbar--top' : '');
          row.innerHTML =
            '<span class="cp-hbar__label"></span>' +
            '<span class="cp-hbar__track"><span class="cp-hbar__fill"></span></span>' +
            '<span class="cp-hbar__val"></span>';
          row.querySelector('.cp-hbar__label').textContent = label;
          row.querySelector('.cp-hbar__val').textContent   = val;
          row.title = `${label}: ${val} unassigned`;
          barsEl.appendChild(row);
          const fillEl = row.querySelector('.cp-hbar__fill');
          setTimeout(() => { fillEl.style.width = Math.round((val / topVal) * 100) + '%'; }, 150 + idx * 70);
        });
        if (ranked.length > MAX_BARS) {
          const more = document.createElement('p');
          more.className = 'cp-hbars__more';
          more.textContent = `+ ${ranked.length - MAX_BARS} more section${ranked.length - MAX_BARS === 1 ? '' : 's'}`;
          barsEl.appendChild(more);
        }
      }
    }

  } catch (err) {
    console.error('[Dashboard] Failed to load:', err);
  }
}

loadDashboard();

// Refresh whenever the page is shown again (back button / bfcache restore)
// or the tab regains focus, so assignments made on other pages show up.
window.addEventListener('pageshow', (e) => { if (e.persisted) loadDashboard(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadDashboard();
});
