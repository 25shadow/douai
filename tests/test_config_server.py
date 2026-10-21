import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import config_server


class ConfigServerTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.sqlite3"
        self.db_path_patch = patch.object(config_server, "DB_PATH", self.db_path)
        self.db_path_patch.start()
        config_server.init_db()

    def tearDown(self):
        self.db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_fresh_database_includes_default_simulation_config(self):
        config = config_server.read_config()
        self.assertEqual(config["simulationConfig"], {
            "durationMinutes": 5,
            "audience": 120,
            "eventIntervalSeconds": 3,
        })
        self.assertEqual(config["voicePrefix"], "")

    def test_migrates_legacy_values_into_empty_database(self):
        result = config_server.migrate_legacy_config({
            "roomId": "room-123",
            "relayUrl": "ws://localhost:8765",
            "simulationConfig": {
                "durationMinutes": 8,
                "audience": 450,
                "eventIntervalSeconds": 4,
            },
        })

        self.assertTrue(result["migrated"])
        self.assertEqual(result["config"]["roomId"], "room-123")
        self.assertEqual(result["config"]["relayUrl"], "ws://localhost:8765")
        self.assertEqual(result["config"]["simulationConfig"], {
            "durationMinutes": 8,
            "audience": 450,
            "eventIntervalSeconds": 4,
        })
        self.assertEqual(result["consumedKeys"], [
            "douai-room-id",
            "douai-relay-url",
            "douai-live-simulation-config",
        ])

    def test_existing_sqlite_values_take_precedence_over_legacy_values(self):
        config_server.migrate_legacy_config({
            "roomId": "saved-room",
            "relayUrl": "ws://saved.example",
            "simulationConfig": {
                "durationMinutes": 9,
                "audience": 600,
                "eventIntervalSeconds": 5,
            },
        })
        result = config_server.migrate_legacy_config({
            "roomId": "stale-room",
            "relayUrl": "ws://stale.example",
            "simulationConfig": {
                "durationMinutes": 12,
                "audience": 999,
                "eventIntervalSeconds": 10,
            },
        })

        self.assertFalse(result["migrated"])
        self.assertEqual(result["config"]["roomId"], "saved-room")
        self.assertEqual(result["config"]["relayUrl"], "ws://saved.example")
        self.assertEqual(result["config"]["simulationConfig"]["durationMinutes"], 9)

    def test_invalid_legacy_simulation_config_does_not_partially_migrate(self):
        with self.assertRaises(ValueError):
            config_server.migrate_legacy_config({
                "roomId": "must-not-save",
                "simulationConfig": {
                    "durationMinutes": 0,
                    "audience": 120,
                    "eventIntervalSeconds": 3,
                },
            })

        config = config_server.read_config()
        self.assertEqual(config["roomId"], "")

    def test_legacy_migration_is_one_time_even_when_sqlite_values_are_defaults(self):
        first = config_server.migrate_legacy_config({"roomId": "first-room"})
        second = config_server.migrate_legacy_config({"roomId": "stale-room"})

        self.assertTrue(first["migrated"])
        self.assertFalse(second["migrated"])
        self.assertEqual(second["config"]["roomId"], "first-room")
        self.assertEqual(second["consumedKeys"], ["douai-room-id"])

    def test_invalid_legacy_simulation_shape_is_rejected(self):
        with self.assertRaises(ValueError):
            config_server.migrate_legacy_config({"simulationConfig": []})
        self.assertEqual(config_server.read_config()["roomId"], "")


if __name__ == "__main__":
    unittest.main()
