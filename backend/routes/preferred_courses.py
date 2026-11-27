"""
routes/preferred_courses.py
----------------------------
Faculty preferred course submission endpoints.

GET    /api/preferred-courses                     — get own submission for active semester
POST   /api/preferred-courses                     — create / replace own submission (saves course preferences)
POST   /api/preferred-courses/finalize            — finalize (submit) the draft
DELETE /api/preferred-courses/<submission_id>     — delete a submission

Chairperson-facing (read):
GET    /api/preferred-courses/all                 — all submissions for active semester
"""

from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from database import db
from models import (
    Course,
    PreferredCourse,
    PreferredCourseSubmission,
    Notification,
    Semester,
    User,
)
from scope import faculty_ids_in_scope, in_scope, chairpersons_for, course_allowed_for_faculty
from routes.auth import current_user, login_required, role_required

preferred_courses_bp = Blueprint("preferred_courses", __name__, url_prefix="/api/preferred-courses")


# ── helpers ──────────────────────────────────
def _active_semester() -> Semester | None:
    return Semester.query.filter_by(is_active=True).first()


def _notify(user_id: int, notif_type: str, title: str, message: str):
    notif = Notification(
        user_id    = user_id,
        notif_type = notif_type,
        title      = title,
        message    = message,
    )
    db.session.add(notif)


# ── Faculty: get own submission ───────────────
@preferred_courses_bp.get("")
@login_required
def get_my_submission():
    user = current_user()
    sem  = _active_semester()
    if not sem:
        return jsonify({"submission": None, "courses": [], "message": "No active semester."}), 200

    sub = PreferredCourseSubmission.query.filter_by(
        faculty_id  = user.id,
        semester_id = sem.id
    ).first()

    # Get the submission-specific preferred courses
    courses = []
    if sub:
        prefs = (
            PreferredCourse.query
            .filter_by(submission_id=sub.id)
            .order_by(PreferredCourse.preference_rank)
            .all()
        )
        courses = [p.to_dict() for p in prefs]

    return jsonify({
        "submission": sub.to_dict() if sub else None,
        "semester":   sem.to_dict(),
        "courses":    courses,
    }), 200


# ── Faculty: save / update preferred courses ─────────────
@preferred_courses_bp.post("")
@login_required
@role_required("faculty")
def save_submission():
    """
    Creates or replaces the draft submission for the active semester.

    Body:
    {
      "courses": [
        { "course_id": 1, "preference_rank": 1 },
        { "course_id": 5, "preference_rank": 2 },
        ...
      ]
    }

    A submission can only be edited while status is 'pending'.
    """
    user = current_user()
    sem  = _active_semester()
    if not sem:
        return jsonify({"error": "No active semester found."}), 400

    body    = request.get_json(silent=True) or {}
    courses = body.get("courses") or []

    if not courses:
        return jsonify({"error": "At least one course is required."}), 400

    # IT faculty may only pick IT + general courses; CS faculty only CS + general.
    for course_data in courses:
        try:
            cid = int(course_data.get("course_id"))
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid course in submission."}), 400
        course = db.session.get(Course, cid)
        if not course:
            return jsonify({"error": f"Course {cid} does not exist."}), 400
        if not course_allowed_for_faculty(user, course):
            return jsonify({
                "error": f"{course.course_code} is a {course.program} course and is not "
                         f"available to your department."
            }), 403

    # Get or create submission
    sub = PreferredCourseSubmission.query.filter_by(
        faculty_id  = user.id,
        semester_id = sem.id
    ).first()

    if sub and sub.status not in ("pending",):
        return jsonify({
            "error": f"Submission cannot be edited — current status is '{sub.status}'."
        }), 409

    if not sub:
        sub = PreferredCourseSubmission(
            faculty_id  = user.id,
            semester_id = sem.id,
            status      = "pending",
        )
        db.session.add(sub)
        db.session.flush()   # get sub.id

    # Replace existing course preferences FOR THIS SUBMISSION
    PreferredCourse.query.filter_by(submission_id=sub.id).delete()

    for course_data in courses:
        pref = PreferredCourse(
            submission_id   = sub.id,
            course_id       = int(course_data.get("course_id")),
            preference_rank = int(course_data.get("preference_rank", 1)),
        )
        db.session.add(pref)

    db.session.commit()
    
    # Reload courses to return
    prefs = (
        PreferredCourse.query
        .filter_by(submission_id=sub.id)
        .order_by(PreferredCourse.preference_rank)
        .all()
    )
    courses_data = [p.to_dict() for p in prefs]

    return jsonify({
        "message": "Preferred courses saved.", 
        "submission": sub.to_dict(),
        "courses": courses_data,
    }), 200


# ── Faculty: finalize (submit) ────────────────
@preferred_courses_bp.post("/finalize")
@login_required
@role_required("faculty")
def finalize_submission():
    """
    Locks the submission and notifies the chairperson.
    Status: pending → submitted
    """
    user = current_user()
    sem  = _active_semester()
    if not sem:
        return jsonify({"error": "No active semester found."}), 400

    sub = PreferredCourseSubmission.query.filter_by(
        faculty_id  = user.id,
        semester_id = sem.id
    ).first()

    if not sub:
        return jsonify({"error": "No draft submission found. Please save courses first."}), 404

    if sub.status not in ("pending",):
        return jsonify({
            "error": f"Submission is already '{sub.status}' and cannot be finalized."
        }), 409

    # Check that at least one course preference exists
    course_count = PreferredCourse.query.filter_by(submission_id=sub.id).count()
    if course_count == 0:
        return jsonify({"error": "Cannot finalize — no courses added."}), 400

    sub.status       = "submitted"
    sub.submitted_at = datetime.now(timezone.utc)

    # Notify chairpersons
    for chair in chairpersons_for([user.id]):
        _notify(
            user_id    = chair.id,
            notif_type = "preferred_courses_received",
            title      = "New Preferred Courses Submission",
            message    = (
                f"{user.first_name} {user.last_name} submitted their preferred courses "
                f"for {sem.semester_term} Semester AY {sem.academic_year}."
            ),
        )

    db.session.commit()
    
    # Reload courses to return
    prefs = (
        PreferredCourse.query
        .filter_by(submission_id=sub.id)
        .order_by(PreferredCourse.preference_rank)
        .all()
    )
    courses_data = [p.to_dict() for p in prefs]

    return jsonify({
        "message": "Submission finalized.", 
        "submission": sub.to_dict(),
        "courses": courses_data,
    }), 200


# ── Chairperson: list all submissions ────────
@preferred_courses_bp.get("/all")
@login_required
@role_required("chairperson")
def get_all_submissions():
    """Return all preferred course submissions for the active semester."""
    sem = _active_semester()
    if not sem:
        return jsonify({"submissions": [], "message": "No active semester."}), 200

    subs = PreferredCourseSubmission.query.filter_by(semester_id=sem.id).all()
    allowed = faculty_ids_in_scope(current_user())   # None = unrestricted
    if allowed is not None:
        subs = [s for s in subs if s.faculty_id in allowed]
    
    # For each submission, include faculty info and their course preferences
    result = []
    for sub in subs:
        faculty = sub.faculty
        prefs = (
            PreferredCourse.query
            .filter_by(submission_id=sub.id)
            .order_by(PreferredCourse.preference_rank)
            .all()
        )
        courses = [p.to_dict() for p in prefs]
        
        result.append({
            **sub.to_dict(),
            "faculty_name": f"{faculty.first_name} {faculty.last_name}" if faculty else "Unknown",
            "courses": courses,
        })

    return jsonify({
        "semester":    sem.to_dict(),
        "submissions": result,
        "counts": {
            "total":     len(subs),
            "submitted": sum(1 for s in subs if s.status == "submitted"),
            "approved":  sum(1 for s in subs if s.status == "approved"),
            "rejected":  sum(1 for s in subs if s.status == "rejected"),
            "pending":   sum(1 for s in subs if s.status == "pending"),
        },
    }), 200


# ── Chairperson: delete a submission ──────────
@preferred_courses_bp.delete("/<int:submission_id>")
@login_required
@role_required("chairperson")
def delete_submission(submission_id: int):
    sub = db.session.get(PreferredCourseSubmission, submission_id)
    if not sub:
        return jsonify({"error": "Submission not found."}), 404
    if not in_scope(current_user(), sub.faculty):
        return jsonify({"error": "Forbidden: this faculty belongs to another department."}), 403

    db.session.delete(sub)
    db.session.commit()
    return jsonify({"message": "Submission deleted."}), 200
