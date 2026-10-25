import json
import os
import re
import signal
import sqlite3
import subprocess
import time
import urllib.error
import urllib.request
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from voice_config import default_voice_config, normalize_voice_config

DB_PATH = Path(__file__).with_name("douai.sqlite3")
DEFAULT_SIMULATION_CONFIG = {
    "durationMinutes": 5,
    "audience": 120,
    "eventIntervalSeconds": 3,
}


def init_db():
    with closing(sqlite3.connect(DB_PATH)) as conn, conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS project_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                room_id TEXT NOT NULL DEFAULT '',
                relay_url TEXT NOT NULL DEFAULT '',
                auto_start INTEGER NOT NULL DEFAULT 0,
                pause_on_disconnect INTEGER NOT NULL DEFAULT 1,
                voice_enabled INTEGER NOT NULL DEFAULT 1,
                voice_volume REAL NOT NULL DEFAULT 0.85,
                voice_rate REAL NOT NULL DEFAULT 1,
                quiz_config TEXT NOT NULL DEFAULT '{}',
                legacy_config_migrated INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        columns = {row[1] for row in conn.execute("PRAGMA table_info(project_config)")}
        if "quiz_config" not in columns:
            conn.execute("ALTER TABLE project_config ADD COLUMN quiz_config TEXT NOT NULL DEFAULT '{}'")
        for name, definition in (
            ("ai_base_url", "TEXT NOT NULL DEFAULT 'https://api.openai.com/v1'"),
            ("ai_api_key", "TEXT NOT NULL DEFAULT ''"),
            ("ai_model", "TEXT NOT NULL DEFAULT 'gpt-4o-mini'"),
            ("voice_prefix", "TEXT NOT NULL DEFAULT ''"),
            ("voice_config", "TEXT"),
            ("simulation_duration_minutes", "INTEGER NOT NULL DEFAULT 5"),
            ("simulation_audience", "INTEGER NOT NULL DEFAULT 120"),
            ("simulation_event_interval_seconds", "INTEGER NOT NULL DEFAULT 3"),
            ("legacy_config_migrated", "INTEGER NOT NULL DEFAULT 0"),
        ):
            if name not in columns:
                conn.execute(f"ALTER TABLE project_config ADD COLUMN {name} {definition}")
        conn.execute("INSERT OR IGNORE INTO project_config (id) VALUES (1)")
        row = conn.execute("SELECT voice_config, voice_enabled, voice_volume, voice_rate, voice_prefix FROM project_config WHERE id=1").fetchone()
        if row[0] is None:
            voice = default_voice_config()
            voice.update(enabled=bool(row[1]), volume=row[2], rate=row[3], prefix=row[4])
            conn.execute("UPDATE project_config SET voice_config=? WHERE id=1", (json.dumps(voice, ensure_ascii=False),))


def save_voice_config(data):
    voice = normalize_voice_config(data)
    with closing(sqlite3.connect(DB_PATH)) as conn, conn:
        conn.execute(
            "UPDATE project_config SET voice_config=?, voice_enabled=?, voice_volume=?, voice_rate=?, voice_prefix=? WHERE id=1",
            (json.dumps(voice, ensure_ascii=False), int(voice["enabled"]), voice["volume"], voice["rate"], voice["prefix"]),
        )
    return voice


def read_config():
    with closing(sqlite3.connect(DB_PATH)) as conn, conn:
        row = conn.execute("SELECT * FROM project_config WHERE id = 1").fetchone()
        columns = [item[1] for item in conn.execute("PRAGMA table_info(project_config)")]
    values = dict(zip(columns, row))
    voice_config = normalize_voice_config(json.loads(values["voice_config"]))
    return {
        "roomId": values["room_id"],
        "relayUrl": values["relay_url"],
        "autoStart": bool(values["auto_start"]),
        "pauseOnDisconnect": bool(values["pause_on_disconnect"]),
        "voiceEnabled": bool(values["voice_enabled"]),
        "voiceVolume": values["voice_volume"],
        "voiceRate": values["voice_rate"],
        "voicePrefix": values["voice_prefix"],
        "voiceConfig": voice_config,
        "quizConfig": json.loads(values["quiz_config"]),
        "aiConfig": {
            "baseUrl": values["ai_base_url"],
            "apiKey": values["ai_api_key"],
            "model": values["ai_model"],
        },
        "simulationConfig": {
            "durationMinutes": values["simulation_duration_minutes"],
            "audience": values["simulation_audience"],
            "eventIntervalSeconds": values["simulation_event_interval_seconds"],
        },
    }


def normalize_simulation_config(data):
    if not isinstance(data, dict):
        raise ValueError("模拟配置格式无效")
    normalized = {}
    for key, minimum, maximum in (
        ("durationMinutes", 1, 180),
        ("audience", 1, 99999),
        ("eventIntervalSeconds", 1, 60),
    ):
        value = data.get(key, DEFAULT_SIMULATION_CONFIG[key])
        if isinstance(value, bool):
            raise ValueError(f"{key} 必须是有效数字")
        try:
            number = int(value)
        except (TypeError, ValueError) as error:
            raise ValueError(f"{key} 必须是有效数字") from error
        if number < minimum or number > maximum or str(number) != str(value).strip():
            raise ValueError(f"{key} 超出允许范围")
        normalized[key] = number
    return normalized


def migrate_legacy_config(data):
    if not isinstance(data, dict):
        raise ValueError("迁移配置格式无效")
    legacy_simulation = data.get("simulationConfig")
    simulation = normalize_simulation_config(legacy_simulation) if legacy_simulation is not None else None
    room_id = str(data.get("roomId") or "").strip()
    relay_url = str(data.get("relayUrl") or "").strip()
    migrated = False

    with closing(sqlite3.connect(DB_PATH)) as conn, conn:
        row = conn.execute(
            """
            SELECT room_id, relay_url, simulation_duration_minutes,
                   simulation_audience, simulation_event_interval_seconds,
                   legacy_config_migrated
            FROM project_config WHERE id=1
            """
        ).fetchone()
        updates = {}
        if not row[5]:
            if not row[0] and room_id:
                updates["room_id"] = room_id
            if not row[1] and relay_url:
                updates["relay_url"] = relay_url
            if simulation is not None:
                columns = (
                    ("simulation_duration_minutes", "durationMinutes", 0),
                    ("simulation_audience", "audience", 1),
                    ("simulation_event_interval_seconds", "eventIntervalSeconds", 2),
                )
                for column, key, index in columns:
                    if row[index + 2] == DEFAULT_SIMULATION_CONFIG[key]:
                        updates[column] = simulation[key]
        if updates:
            assignments = ", ".join(f"{column}=?" for column in updates)
            conn.execute(
                f"UPDATE project_config SET {assignments} WHERE id=1",
                tuple(updates.values()),
            )
            migrated = True
        if not row[5]:
            conn.execute("UPDATE project_config SET legacy_config_migrated=1 WHERE id=1")

    consumed_keys = []
    if "roomId" in data:
        consumed_keys.append("douai-room-id")
    if "relayUrl" in data:
        consumed_keys.append("douai-relay-url")
    if "simulationConfig" in data:
        consumed_keys.append("douai-live-simulation-config")
    return {"config": read_config(), "migrated": migrated, "consumedKeys": consumed_keys}


def generate_questions(data):
    config = read_config()["aiConfig"]
    base_url = str(data.get("baseUrl") or config["baseUrl"]).strip().rstrip("/")
    api_key = str(data.get("apiKey") or config["apiKey"]).strip()
    model = str(data.get("model") or config["model"]).strip()
    theme = str(data.get("theme") or "").strip()
    count = max(1, min(100, int(data.get("count") or 10)))
    difficulty = str(data.get("difficulty") or "mixed")
    if not api_key or not model or not theme:
        raise ValueError("请先填写 API Key、模型和题库主题")
    if not re.match(r"^https?://", base_url):
        raise ValueError("API 地址必须以 http:// 或 https:// 开头")

    prompt = (
        "生成中文知识问答选择题。只返回 JSON 对象，不要 Markdown。"
        '格式：{"category":"主题","results":[{"type":"multiple","difficulty":"easy",'
        '"question":"题目","correct_answer":"正确选项","incorrect_answers":["错误1","错误2","错误3"]}]}。'
        f"主题：{theme}；数量：{count}；难度：{difficulty}。"
        "题干和选项要准确、无重复，四个选项互不重复，正确答案唯一。"
    )
    payload = json.dumps({
        "model": model,
        "temperature": 0.7,
        "messages": [
            {"role": "system", "content": "你是严谨的中文知识题库编辑。"},
            {"role": "user", "content": prompt},
        ],
    }).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise ValueError(f"AI 接口返回 {error.code}：{detail}") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise ValueError(f"无法连接 AI 接口：{error}") from error
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    match = re.search(r"\{[\s\S]*\}", content)
    if not match:
        raise ValueError("AI 返回内容不是有效 JSON")
    bank = json.loads(match.group(0))
    if not isinstance(bank.get("results"), list) or not bank["results"]:
        raise ValueError("AI 没有生成有效题目")
    return bank


class ConfigHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        try:
            super().log_message(format, *args)
        except OSError:
            pass

    def _send(self, status, body):
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/config":
            self._send(200, read_config())
        else:
            self._send(404, {"error": "not found"})

    def do_PUT(self):
        if self.path == "/api/config/voice":
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length) or "{}")
                self._send(200, save_voice_config(data))
            except (ValueError, TypeError) as error:
                self._send(400, {"error": str(error)})
            return
        if self.path != "/api/config":
            self._send(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length) or "{}")
        simulation = normalize_simulation_config(data.get("simulationConfig") or DEFAULT_SIMULATION_CONFIG)
        with closing(sqlite3.connect(DB_PATH)) as conn, conn:
            conn.execute(
                """
                UPDATE project_config
                SET room_id=?, relay_url=?, auto_start=?, pause_on_disconnect=?,
                    quiz_config=?,
                    ai_base_url=?, ai_api_key=?, ai_model=?,
                    simulation_duration_minutes=?, simulation_audience=?,
                    simulation_event_interval_seconds=?
                WHERE id=1
                """,
                (
                    str(data.get("roomId", "")),
                    str(data.get("relayUrl", "")),
                    int(bool(data.get("autoStart"))),
                    int(bool(data.get("pauseOnDisconnect", True))),
                    json.dumps(data.get("quizConfig", {}), ensure_ascii=False),
                    str(data.get("aiConfig", {}).get("baseUrl", "https://api.openai.com/v1")),
                    str(data.get("aiConfig", {}).get("apiKey", "")),
                    str(data.get("aiConfig", {}).get("model", "gpt-4o-mini")),
                    simulation["durationMinutes"],
                    simulation["audience"],
                    simulation["eventIntervalSeconds"],
                ),
            )
        self._send(200, read_config())

    def do_POST(self):
        if self.path == "/api/config/migrate-legacy":
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length) or "{}")
                self._send(200, migrate_legacy_config(data))
            except (ValueError, json.JSONDecodeError) as error:
                self._send(400, {"error": str(error)})
            return
        if self.path != "/api/ai/generate":
            self._send(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length) or "{}")
            self._send(200, {"bank": generate_questions(data)})
        except (ValueError, KeyError, IndexError, json.JSONDecodeError) as error:
            self._send(400, {"error": str(error)})


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


def _is_server_healthy(port=8787):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(f"http://127.0.0.1:{port}/api/config", timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False


def _TerminateStaleServer():
    my_pid = os.getpid()
    try:
        output = subprocess.check_output(["pgrep", "-f", "config_server.py"], text=True)
        for line in output.splitlines():
            pid = int(line.strip())
            if pid != my_pid:
                os.kill(pid, signal.SIGTERM)
        time.sleep(0.3)
    except Exception:
        pass


if __name__ == "__main__":
    init_db()
    if _is_server_healthy(8787):
        print("DouAi SQLite config API already running: http://127.0.0.1:8787")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            pass
    else:
        _TerminateStaleServer()
        print("DouAi SQLite config API: http://127.0.0.1:8787")
        ReusableThreadingHTTPServer(("127.0.0.1", 8787), ConfigHandler).serve_forever()
