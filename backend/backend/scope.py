"""
scope.py
--------
Department scoping for chairpersons.

A chairperson whose employee number is a ``CP-###`` id and whose department is
Information Technology or Computer Science only sees and manages faculty of
that same department (and the course sections of that program). Other
chairperson accounts (the seeded ADMIN-000 / DEMO accounts) are *unscoped* and
keep access to everyone.

Track codes: "IT" | "CS". ``None`` means "no restriction".
"""

from __future__ import annotations

from models import User

TRACK_DEPARTMENT = {
    "IT": "Department of Information Technology",
    "CS": "Department of Computer Science",
}


def department_track(department: str | None) -> str | None:
    d = (department or "").lower()
    if "computer science" in d:
        return "CS"
    if "information technology" in d:
        return "IT"
    return None


def chair_track(user: User | None) -> str | None:
    """The track a chairperson is limited to, or None if unrestricted."""
    if not user or user.role != "chairperson":
        return None
    if not (user.employee_number or "").upper().startswith("CP-"):
        return None
    return department_track(user.department)


def faculty_track(faculty: User | None) -> str | None:
    return department_track(faculty.department) if faculty else None


def in_scope(user: User | None, faculty: User | None) -> bool:
    """May this user act on this faculty member? Non-chairpersons and
    unscoped chairpersons are not restricted here (role checks live elsewhere)."""
    track = chair_track(user)
    return track is None or faculty_track(faculty) == track


def scope_faculty_query(user: User | None, query):
    """Narrow a User query to the chairperson's department."""
    track = chair_track(user)
    if track is None:
        return query
    return query.filter(User.department == TRACK_DEPARTMENT[track])


def faculty_ids_in_scope(user: User | None) -> set[int] | None:
    """IDs of faculty the chairperson may touch, or None for 'everyone'."""
    track = chair_track(user)
    if track is None:
        return None
    rows = User.query.filter_by(role="faculty", department=TRACK_DEPARTMENT[track]).all()
    return {u.id for u in rows}


def course_in_scope(user: User | None, course) -> bool:
    track = chair_track(user)
    return track is None or (course is not None and (course.program or "").upper() == track)


def chairpersons_for(faculty_ids) -> list[User]:
    """Chairpersons who should hear about events concerning these faculty:
    every unscoped chairperson, plus scoped ones whose track matches."""
    tracks = {faculty_track(u) for u in User.query.filter(User.id.in_(list(faculty_ids))).all()} \
        if faculty_ids else set()
    out = []
    for chair in User.query.filter_by(role="chairperson").all():
        t = chair_track(chair)
        if t is None or not tracks or t in tracks:
            out.append(chair)
    return out


def section_track(section) -> str | None:
    """IT/CS track of a section. Section.program_code (BSIT/BSCS) is
    authoritative -- shared courses like COMP 001 have sections in both
    programs -- with the course's owning track as a fallback."""
    raw = (getattr(section, "program_code", None) or "").strip().upper()
    if raw in ("BSIT", "IT"):
        return "IT"
    if raw in ("BSCS", "CS"):
        return "CS"
    course = getattr(section, "course", None)
    prog = (getattr(course, "program", None) or "").strip().upper()
    return prog if prog in ("IT", "CS") else None


def section_in_scope(user: User | None, section) -> bool:
    track = chair_track(user)
    return track is None or section_track(section) == track
