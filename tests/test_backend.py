from __future__ import annotations

import unittest

from rhelo_backend.config import get_settings
from rhelo_backend.database import database_is_ready
from rhelo_backend.mcp_server import TOOL_NAMES
from rhelo_backend.services import mcp_service


class BackendContractTests(unittest.TestCase):
    def test_canonical_product_and_database_names(self) -> None:
        settings = get_settings()
        self.assertEqual(settings.product_name, "Rhelo Study Engine")
        self.assertEqual(settings.database_path.name, "rhelo.db")

    def test_expected_mcp_tools_are_registered(self) -> None:
        self.assertEqual(len(TOOL_NAMES), 8)
        self.assertIn("search_scriptures", TOOL_NAMES)
        self.assertIn("get_verse_details", TOOL_NAMES)

    @unittest.skipUnless(database_is_ready(), "rhelo.db is not available")
    def test_scripture_search_contract(self) -> None:
        result = mcp_service.search_scriptures("beginning", "GEN")
        self.assertIn("[GEN.1.1]", result)

    @unittest.skipUnless(database_is_ready(), "rhelo.db is not available")
    def test_verse_details_contract(self) -> None:
        result = mcp_service.get_verse_details("GEN.1.1")
        self.assertIn("English (en_bsb)", result)
        self.assertIn("Original Text", result)

    @unittest.skipUnless(database_is_ready(), "rhelo.db is not available")
    def test_each_english_translation_is_searchable(self) -> None:
        expected = {
            "en_bsb": "In the beginning God created the heavens",
            "en_web": "In the beginning, God created the heavens",
            "en_kjv": "In the beginning God created the heaven",
        }
        for code, phrase in expected.items():
            with self.subTest(code=code):
                details = mcp_service.get_verse_details("GEN.1.1", code)
                self.assertIn(phrase, details)

    @unittest.skipUnless(database_is_ready(), "rhelo.db is not available")
    def test_translation_fts_has_complete_fallback_coverage(self) -> None:
        import sqlite3

        connection = sqlite3.connect(get_settings().database_path)
        try:
            counts = dict(connection.execute(
                "SELECT translation_code, count(*) FROM search_english_translations GROUP BY translation_code"
            ))
        finally:
            connection.close()
        self.assertEqual(counts, {"en_bsb": 31100, "en_kjv": 31100, "en_web": 31100})


if __name__ == "__main__":
    unittest.main()
