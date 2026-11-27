#!/usr/bin/env python
"""Test script to verify all imports work correctly."""

print("Testing imports...")

try:
    from models import PreferredCourseSubmission
    print("✓ PreferredCourseSubmission model imported")
except Exception as e:
    print(f"✗ Failed to import PreferredCourseSubmission: {e}")
    exit(1)

try:
    from routes.preferred_courses import preferred_courses_bp
    print("✓ preferred_courses blueprint imported")
except Exception as e:
    print(f"✗ Failed to import preferred_courses blueprint: {e}")
    exit(1)

try:
    from app import create_app
    print("✓ App factory imported")
    app = create_app()
    print("✓ App created successfully")
except Exception as e:
    print(f"✗ Failed to create app: {e}")
    exit(1)

print("\n✅ All imports successful!")
