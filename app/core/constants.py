"""Ecclesiastical constants and option sets for DCLM Field Utility."""
from __future__ import annotations

# 1. Church Sections / Wings
CHURCH_TYPES: list[tuple[str, str]] = [
    ("DCLM", "DCLM (Adult Church)"),
    ("YPF", "YPF (Young Adult / Professionals)"),
    ("DLCF", "DLCF (Campus Fellowship)"),
    ("DLSO", "DLSO (Youth Church)"),
    ("ALL", "ALL (Combined Congregation)"),
]

# 2. Program Domains
PROGRAM_DOMAINS: list[tuple[str, str]] = [
    ("Weekly", "Weekly Routine Services"),
    ("Crusade", "Global / City Outreach Crusades"),
    ("Retreat", "Workers / Church Retreats"),
    ("Conference", "Leadership / Specialized Conferences"),
    ("Special", "Special Events & Thanksgiving"),
]

# 3. Domain to Program Types Mapping
PROGRAM_TYPES_BY_DOMAIN: dict[str, list[str]] = {
    "Weekly": [
        "Sunday Worship Service",
        "Monday Bible Study",
        "Thursday Revival & Training",
        "Home Caring Fellowship",
        "Personal Evangelism",
    ],
    "Crusade": [
        "Global Crusade with Kumuyi (GCK)",
        "City-Wide Impact Crusade",
        "Campus Explosion Crusade",
        "Youth Revival Rally",
    ],
    "Retreat": [
        "National Workers Retreat",
        "Easter Retreat",
        "December Retreat",
        "Leadership Spiritual Retreat",
    ],
    "Conference": [
        "Leadership Development Conference",
        "State Overseers Conference",
        "Professionals Conference",
        "Youth Empowerment Summit",
    ],
    "Special": [
        "Annual Thanksgiving Service",
        "Covenant Sunday Service",
        "Solemn Assembly",
        "Special Musical Concert",
        "Marriage Dedication",
        "Water Baptism Service",
    ],
}

# 4. Ecclesiastical Hierarchy Levels
PROGRAM_LEVELS: list[tuple[str, str]] = [
    ("Local", "Local Church (Location Level 6)"),
    ("Group", "Group Headquarters (Level 5)"),
    ("Region", "Region Headquarters (Level 4)"),
    ("State", "State Headquarters (Level 3)"),
    ("National", "National Office (Level 2)"),
    ("Global", "Global Headquarters (Level 1)"),
]

# 5. Headcount Demographic Categories
COUNT_CATEGORIES: list[dict[str, str]] = [
    {"key": "adult_male", "label": "Adult Male", "icon": "person-standing", "tone": "primary"},
    {"key": "adult_female", "label": "Adult Female", "icon": "person-standing-dress", "tone": "info"},
    {"key": "youth_male", "label": "Youth Male", "icon": "person", "tone": "warning"},
    {"key": "youth_female", "label": "Youth Female", "icon": "person-dress", "tone": "danger"},
    {"key": "boys", "label": "Boys", "icon": "emoji-smile", "tone": "success"},
    {"key": "girls", "label": "Girls", "icon": "heart", "tone": "secondary"},
]

# 6. Finance / Offering Fund Types & Payment Methods
FUND_TYPES: list[tuple[str, str]] = [
    ("offering", "Regular Offering"),
    ("tithe", "Tithe"),
    ("thanksgiving", "Thanksgiving Offering"),
    ("building_project", "Building / Church Project"),
    ("evangelism_support", "Evangelism & Missions"),
]

PAYMENT_METHODS: list[tuple[str, str]] = [
    ("cash", "Cash"),
    ("bank_transfer", "Bank Transfer"),
    ("mobile_money", "Mobile Money / POS"),
]

# 7. Convert / Newcomer Options
SALVATION_TYPES: list[tuple[str, str]] = [
    ("Fresh Convert", "Fresh Convert (Salvation)"),
    ("Restoration", "Restoration / Backslider Return"),
    ("Sanctification", "Seeking Holiness / Sanctification"),
    ("Holy Ghost", "Holy Ghost Baptism"),
    ("Healing", "Divine Healing & Miracles"),
    ("Inquirer", "Inquirer / Guest"),
]

MARITAL_STATUSES: list[tuple[str, str]] = [
    ("Single", "Single"),
    ("Married", "Married"),
    ("Widowed", "Widowed"),
    ("Other", "Other"),
]

SOCIAL_STATUSES: list[tuple[str, str]] = [
    ("Student", "Student"),
    ("Worker", "Civil Servant / Employed"),
    ("Business", "Self Employed / Business"),
    ("Professional", "Professional / Executive"),
    ("Artisan", "Artisan / Trader"),
    ("Retiree", "Retiree"),
    ("Other", "Other"),
]
