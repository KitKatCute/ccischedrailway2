# Code Review: Submit Preferred Courses Feature

## Review Summary

**Verdict**: CHANGES_REQUESTED

The implementation adds the UI components and API structure as requested, but contains a **critical data corruption vulnerability** that makes the feature unsafe to deploy. The core issue is misuse of the `FacultyCourseQualification` table, which is shared system infrastructure used by the scheduler.

---

## Critical Blocker

### Finding 1: Data Corruption in save_submission Endpoint

**File**: `backend/routes/preferred_courses.py`, line 136  
**Severity**: CRITICAL BLOCKER

**Issue**:
```python
# Replace existing course preferences
FacultyCourseQualification.query.filter_by(faculty_id=user.id).delete()
```

This deletes ALL course qualifications for the faculty member across the entire system, not just the current semester's preferred courses submission.

**Evidence**:
1. `FacultyCourseQualification` is a **master data table** used by the scheduler (`backend/app.py` line 321-323):
   ```python
   def _build_qualified_by_course() -> dict[int, set[int]]:
       """{course_id: {faculty_id, ...}} from FacultyCourseQualification"""
       for q in FacultyCourseQualification.query.all():
           result.setdefault(q.course_id, set()).add(q.faculty_id)
   ```

2. The table is populated by CSV import in `init_db.py` (line 626-633) and represents permanent faculty qualifications, NOT semester-specific submissions.

3. The table has NO `semester_id` or `submission_id` field (models.py line 320-323), so there's no way to scope deletions to a specific submission.

**User-Visible Consequence**:
- When a faculty submits preferred courses, it **destroys** all their qualification data used by the scheduler
- This breaks faculty-to-course matching in schedule generation
- Multiple concurrent faculty submissions could race and corrupt each other's data
- Re-importing CSV data would be required to restore system integrity

**Required Correction**:
The implementation must follow the same pattern as `AvailabilitySlot`:
- Create a new model `PreferredCourse` with fields: `id`, `submission_id`, `course_id`, `preference_rank`
- Link it to `PreferredCourseSubmission` via `submission_id` foreign key
- Delete scoped to `submission_id`, not `faculty_id`
- Leave `FacultyCourseQualification` untouched

**Correct Pattern** (see `backend/routes/availability.py` line 189):
```python
AvailabilitySlot.query.filter_by(submission_id=sub.id).delete()
```

---

## Additional Issues

### Finding 2: Missing to_dict Method Call

**File**: `backend/routes/preferred_courses.py`, line 334  
**Severity**: Minor

The `course` relationship is accessed but the Course model's `to_dict()` method includes the field as `code`, while the template expects `course_code`. The code at line 334 returns:
```python
"course_code": self.course.course_code if self.course else None,
```

However, Course model's `to_dict()` returns `"code"` not `"course_code"` (models.py line 202). The implementation works but is inconsistent. This is not a blocker since the code compensates correctly.

---

## Verification Status

**Missing**: No test execution evidence was found. The implementation summary includes a test script (`backend/test_imports.py`) but no logs showing it was run. The testing checklist in `IMPLEMENTATION_SUMMARY.md` has all boxes unchecked.

**Required**: Evidence that imports succeed and backend starts without errors.

---

## What Works

The following components are correctly implemented:

1. ✅ **UI Components**: Dashboard card, submission form, and view page match the existing availability pattern
2. ✅ **API Structure**: Endpoints follow RESTful conventions and match availability pattern
3. ✅ **Model Definition**: `PreferredCourseSubmission` model is correctly defined with proper relationships
4. ✅ **Blueprint Registration**: Properly imported and registered in `app.py` (line 95, 113)
5. ✅ **Notification Integration**: Uses `chairpersons_for()` correctly to notify chairpersons (line 199-207)
6. ✅ **Frontend API Integration**: All five API methods properly exported in `api.js` (line 507-511)
7. ✅ **Drag-and-Drop UI**: HTML5 drag API implementation for reordering is functional
8. ✅ **Status Tracking**: Proper status badge system matching availability

---

## Required Changes

To approve this implementation:

1. **MUST FIX**: Create `PreferredCourse` model with `submission_id` foreign key
2. **MUST FIX**: Update `save_submission` to delete by `submission_id` instead of `faculty_id`
3. **MUST FIX**: Update `get_my_submission` to query `PreferredCourse` instead of `FacultyCourseQualification`
4. **MUST FIX**: Update `get_all_submissions` to query `PreferredCourse` instead of `FacultyCourseQualification`
5. **MUST PROVIDE**: Test execution evidence showing backend starts and imports work

---

## Files Reviewed

- ✅ `backend/routes/preferred_courses.py` (all endpoints)
- ✅ `backend/models.py` (PreferredCourseSubmission, FacultyCourseQualification, Course models)
- ✅ `backend/app.py` (blueprint registration, table creation, scheduler usage)
- ✅ `src/faculty/dashboard.html` (card UI)
- ✅ `src/faculty/submit-preferred-courses.html` (submission form)
- ✅ `src/faculty/view-preferred-courses.html` (view page)
- ✅ `src/scripts/submit-preferred-courses.js` (form logic)
- ✅ `src/scripts/view-preferred-courses.js` (display logic)
- ✅ `src/scripts/api.js` (API method exports)
- ✅ `backend/init_db.py` (FacultyCourseQualification usage)
- ✅ `backend/scope.py` (chairpersons_for verification)
- ✅ `backend/routes/availability.py` (reference pattern)

---

## Review Completed

The feature demonstrates good UI/UX consistency and follows project conventions, but the data model design creates a critical safety issue that must be resolved before deployment.
