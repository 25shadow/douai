import copy
import math


def default_voice_config():
    templates = {
        "gift": "感谢{昵称}送出的{礼物}{数量}个！",
        "like": "感谢{昵称}点赞{点赞数}次！",
        "follow": "感谢{昵称}关注直播间！",
        "join": "欢迎{昵称}来到直播间！",
        "share": "感谢{昵称}分享直播间！",
    }
    scenes = {}
    for key, priority, cooldown in (
        ("gift", 2, 1000), ("like", 1, 3000), ("follow", 2, 0),
        ("join", 1, 3000), ("share", 1, 0),
    ):
        scenes[key] = dict(enabled=True, template=templates[key], prefix="", priority=priority, maxLength=200, cooldownMs=cooldown)
    return dict(version=1, provider="browser", enabled=True, voiceURI="", voiceName="", lang="zh-CN",
                favoriteVoiceURIs=[], volume=.85, rate=1, pitch=1, prefix="", queueMode="queue",
                maxQueueSize=10, dedupeWindowMs=3000, scenes=scenes)


def normalize_voice_config(data):
    if not isinstance(data, dict):
        raise ValueError("语音配置格式无效")
    def number(value, minimum, maximum, key, integer=False):
        if (type(value) not in (int, float) or not math.isfinite(value)
                or not minimum <= value <= maximum or (integer and int(value) != value)):
            raise ValueError(f"{key} 必须在 {minimum} 到 {maximum} 之间")
    def text(value, maximum, key):
        if not isinstance(value, str) or len(value) > maximum:
            raise ValueError(f"{key} 最多 {maximum} 个字符")
    if type(data.get("version")) is not int or data["version"] != 1 or data.get("provider") != "browser":
        raise ValueError("语音配置版本无效")
    if type(data.get("enabled")) is not bool:
        raise ValueError("语音开关无效")
    for key, limit in (("voiceURI", 500), ("voiceName", 500), ("lang", 50), ("prefix", 100)):
        text(data.get(key), limit, key)
    for key, low, high, integer in (
        ("volume", 0, 1, False), ("rate", .5, 2, False), ("pitch", 0, 2, False),
        ("maxQueueSize", 1, 50, True), ("dedupeWindowMs", 0, 60000, True),
    ):
        number(data.get(key), low, high, key, integer)
    if data.get("queueMode") not in ("queue", "interrupt", "drop"):
        raise ValueError("队列策略无效")
    favorites = data.get("favoriteVoiceURIs")
    if not isinstance(favorites, list) or len(favorites) > 100:
        raise ValueError("收藏音色无效")
    for value in favorites:
        text(value, 500, "收藏音色")
    scenes = data.get("scenes")
    if not isinstance(scenes, dict):
        raise ValueError("场景配置无效")
    defaults = default_voice_config()["scenes"]
    normalized_scenes = {}
    for key in defaults:
        policy = scenes.get(key)
        if not isinstance(policy, dict):
            # Older saved configurations only had quiz, answer, gift, like, and system.
            policy = scenes[key] = copy.deepcopy(defaults[key])
        if type(policy.get("enabled")) is not bool:
            raise ValueError(f"{key} 场景无效")
        if "template" not in policy:
            policy["template"] = defaults[key]["template"]
        text(policy.get("template"), 300, "播报内容")
        text(policy.get("prefix"), 100, "场景前缀")
        for field, low, high in (("priority", 0, 3), ("maxLength", 20, 1000), ("cooldownMs", 0, 60000)):
            number(policy.get(field), low, high, field, True)
        normalized_scenes[key] = copy.deepcopy(policy)
    result = copy.deepcopy(data)
    result["scenes"] = normalized_scenes
    return result
