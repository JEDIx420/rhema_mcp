from __future__ import annotations


DEFAULT_ENGLISH_TRANSLATION = "en_bsb"
ENGLISH_TRANSLATIONS = (
    {"code": "en_bsb", "short_label": "bsb", "label": "Berean Standard Bible", "public_domain": True},
    {"code": "en_web", "short_label": "web", "label": "World English Bible", "public_domain": True},
    {"code": "en_kjv", "short_label": "kjv", "label": "King James Version", "public_domain": True},
)
SUPPORTED_ENGLISH_TRANSLATIONS = {item["code"] for item in ENGLISH_TRANSLATIONS}


def normalize_translation_code(value: str | None) -> str:
    return value if value in SUPPORTED_ENGLISH_TRANSLATIONS else DEFAULT_ENGLISH_TRANSLATION
