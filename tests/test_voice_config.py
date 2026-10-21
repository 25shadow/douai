import copy
import json
import sqlite3
import tempfile
import unittest
import threading
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from contextlib import closing

import config_server


class VoiceConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "voice.sqlite3"
        self.patch = patch.object(config_server, "DB_PATH", self.path)
        self.patch.start()
        config_server.init_db()

    def tearDown(self):
        self.patch.stop()
        self.temp.cleanup()

    def test_legacy_values_survive_repeatable_migration(self):
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute("UPDATE project_config SET voice_config=NULL, voice_enabled=0, voice_volume=.4, voice_rate=1.2, voice_prefix='提示'")
        config_server.init_db()
        config_server.init_db()
        voice = config_server.read_config()["voiceConfig"]
        self.assertFalse(voice["enabled"])
        self.assertEqual(voice["volume"], .4)
        self.assertEqual(voice["prefix"], "提示")

    def test_voice_save_roundtrip_does_not_touch_other_settings(self):
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute("UPDATE project_config SET room_id='keep-me'")
        voice = config_server.read_config()["voiceConfig"]
        voice["voiceURI"] = "test-voice"
        voice["pitch"] = 1.3
        voice["scenes"]["like"]["enabled"] = False
        saved = config_server.save_voice_config(voice)
        self.assertEqual(saved, voice)
        self.assertEqual(config_server.read_config()["roomId"], "keep-me")
        self.assertEqual(config_server.read_config()["voiceConfig"]["pitch"], 1.3)

    def test_old_quiz_scenes_migrate_to_live_event_templates(self):
        voice = config_server.read_config()["voiceConfig"]
        voice["scenes"]["quiz"] = {"enabled": False, "prefix": "", "priority": 3, "maxLength": 1000, "cooldownMs": 0}
        voice["scenes"]["answer"] = voice["scenes"]["quiz"]
        migrated = config_server.normalize_voice_config(voice)
        self.assertNotIn("quiz", migrated["scenes"])
        self.assertNotIn("answer", migrated["scenes"])
        self.assertEqual(migrated["scenes"]["gift"]["template"], "感谢{昵称}送出的{礼物}{数量}个！")

    def test_read_config_normalizes_saved_voice_scene_schema(self):
        voice = config_server.default_voice_config()
        voice["scenes"]["quiz"] = {"enabled": True}
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute("UPDATE project_config SET voice_config=?", (json.dumps(voice),))
        loaded = config_server.read_config()["voiceConfig"]
        self.assertNotIn("quiz", loaded["scenes"])
        self.assertIn("follow", loaded["scenes"])

    def test_invalid_configuration_is_rejected_atomically(self):
        original = config_server.read_config()["voiceConfig"]
        for key, value in (("rate", float("nan")), ("enabled", "false"), ("maxQueueSize", 0), ("queueMode", "invalid")):
            invalid = copy.deepcopy(original)
            invalid[key] = value
            with self.assertRaises(ValueError):
                config_server.save_voice_config(invalid)
        self.assertEqual(config_server.read_config()["voiceConfig"], original)

    def test_http_save_errors_and_stale_full_project_save(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), config_server.ConfigHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        def put(path, data):
            payload = data if isinstance(data, bytes) else json.dumps(data).encode()
            request = urllib.request.Request(base + path, data=payload, method="PUT", headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(request) as response:
                return json.load(response)
        try:
            stale = config_server.read_config()
            voice = copy.deepcopy(stale["voiceConfig"])
            voice["pitch"] = 1.4
            self.assertEqual(put("/api/config/voice", voice)["pitch"], 1.4)
            stale["roomId"] = "new-room"
            result = put("/api/config", stale)
            self.assertEqual(result["voiceConfig"]["pitch"], 1.4)
            self.assertEqual(result["roomId"], "new-room")
            for data in (b"{", b"[]", b'{"enabled":true}'):
                with self.assertRaises(urllib.error.HTTPError) as raised:
                    put("/api/config/voice", data)
                self.assertEqual(raised.exception.code, 400)
            self.assertEqual(config_server.read_config()["voiceConfig"]["pitch"], 1.4)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
