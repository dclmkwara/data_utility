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
    ("Weekly", "Weekly Programs"),
    ("Crusade", "Global Crusade"),
    ("Retreat", "Retreat"),
    ("Conference", "Conferences"),
    ("Special", "Special Programs"),
]

# 3. Domain to Program Types Mapping
PROGRAM_TYPES_BY_DOMAIN: dict[str, list[str]] = {
    "Weekly": [
        "Sunday Worship Service",
        "Monday Bible Study",
        "Tuesday Leaders Meeting",
        "Thursday Revival Hour",
        "Saturday Workers Meeting",
    ],
    "Crusade": [
        "Crusade Evening",
        "Leadership Development Meeting",
        "Impact Academy",
        "Global Sunday Service",
    ],
    "Retreat": [
        "Faith Clinic",
        "Retreat Bible Study",
        "Revival Session",
        "Seminar",
    ],
    "Conference": [
        "Workers Conference",
        "Ministers and Leaders Strategic Conference",
        "Youth and Campus Conference",
    ],
    "Special": [
        "Special Rally",
        "Solemn Assembly",
        "Anniversary Celebration",
    ],
}

# 4. Ecclesiastical Hierarchy Levels
PROGRAM_LEVELS: list[tuple[str, str]] = [
    ("Local", "Location scope (pastoral level 2)"),
    ("Group", "Group scope (pastoral level 3)"),
    ("Region", "Region scope (pastoral level 4)"),
    ("State", "State scope (pastoral level 5)"),
    ("National", "National scope (higher-tier client)"),
    ("Global", "Global scope (higher-tier client)"),
]

FELLOWSHIP_GROUPS: list[tuple[str, str]] = [
    ("adult", "Adult Fellowship"),
    ("young_adult", "Young Adult Fellowship"),
    ("campus", "Campus Fellowship"),
    ("youth", "Youth Fellowship"),
    ("children", "Children Fellowship"),
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
    ("tithe", "Tithe"),
    ("offering", "Offering"),
    ("tithe_offering", "Tithe & Offering"),
]

PAYMENT_METHODS: list[tuple[str, str]] = [
    ("cash", "Cash"),
    ("bank_transfer", "Bank Transfer"),
    ("mobile_money", "Mobile Money / POS"),
]

# 7. Convert / Newcomer Options
SALVATION_TYPES: list[tuple[str, str]] = [
    ("New Convert", "New Convert"),
    ("Restoration", "Restoration"),
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
