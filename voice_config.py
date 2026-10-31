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
        scenes[key] = dict(enabled=True, template=templates[key], prefix="", priority=priority, maxLength=200, cooldownMs=cooldown,
                            output=dict(voice=True, text=False))
    return dict(version=1, provider="browser", enabled=True, voiceURI="", voiceName="", lang="zh-CN",
                favoriteVoiceURIs=[], volume=.85, rate=1, pitch=1, prefix="", queueMode="queue",
                maxQueueSize=10, dedupeWindowMs=3000,
                chat=dict(enabled=True, triggerMode="all", keywords=[], maxLength=100, cooldownMs=3000,
                          output=dict(voice=True, text=False)),
                aiInteraction=dict(enabled=False, triggerMode="smart", keywords=[],
                                   globalCooldownMs=15000, userCooldownMs=60000, maxLength=100,
                                   maxPerMinute=4, maxPerSession=100, requireConfidence=.75,
                                   persona="friendly-host",
                                   interactionRule="只回答和当前直播有关的问题；闲聊时自然回应，遇到重复刷屏、广告或无意义内容时保持安静；回答简短，不要抢主播的话。",
                                   systemPrompt="", streamContext="",
                                   blockedKeywords=[], blockLinks=True, blockAds=True,
                                   output=dict(voice=True, text=False),
                                   fallbackText="这个问题我暂时不能确认，稍后再和你聊。",
                                   recentMessageCount=20, perUserMessageCount=3),
                scenes=scenes)


def normalize_voice_config(data):
    if not isinstance(data, dict):
        raise ValueError("语音配置格式无效")
    data = copy.deepcopy(data)
    defaults = default_voice_config()
    data["chat"] = {**defaults["chat"], **(data.get("chat") or {}), "enabled": True}
    data["aiInteraction"] = {**defaults["aiInteraction"], **(data.get("aiInteraction") or {})}
    def number(value, minimum, maximum, key, integer=False):
        if (type(value) not in (int, float) or not math.isfinite(value)
                or not minimum <= value <= maximum or (integer and int(value) != value)):
            raise ValueError(f"{key} 必须在 {minimum} 到 {maximum} 之间")
    def text(value, maximum, key):
        if not isinstance(value, str) or len(value) > maximum:
            raise ValueError(f"{key} 最多 {maximum} 个字符")
    def output(value, key):
        if not isinstance(value, dict) or type(value.get("voice")) is not bool or type(value.get("text")) is not bool:
            raise ValueError(f"{key} 输出设置无效")
        if not value["voice"] and not value["text"]:
            raise ValueError(f"{key} 至少需要保留一种输出方式")
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
    chat = data.get("chat")
    ai = data.get("aiInteraction")
    if not isinstance(chat, dict) or type(chat.get("enabled")) is not bool or chat.get("triggerMode") not in ("all", "keyword"):
        raise ValueError("弹幕朗读设置无效")
    if not isinstance(ai, dict) or type(ai.get("enabled")) is not bool or ai.get("triggerMode") not in ("smart", "mention", "keyword"):
        raise ValueError("AI互动设置无效")
    for policy, fields in (
        (chat, (("maxLength", 10, 500), ("cooldownMs", 0, 60000))),
        (ai, (("globalCooldownMs", 1000, 300000), ("userCooldownMs", 0, 3600000), ("maxLength", 20, 500))),
    ):
        for field, low, high in fields:
            number(policy.get(field), low, high, field, True)
        keywords = policy.get("keywords")
        if not isinstance(keywords, list) or len(keywords) > 20:
            raise ValueError("互动关键词无效")
        for keyword in keywords:
            text(keyword, 50, "互动关键词")
    output(chat.get("output"), "弹幕")
    output(ai.get("output"), "AI互动")
    for field, minimum, maximum in (
        ("maxPerMinute", 1, 60), ("maxPerSession", 1, 1000),
        ("recentMessageCount", 0, 50), ("perUserMessageCount", 0, 10),
    ):
        number(ai.get(field), minimum, maximum, field, True)
    number(ai.get("requireConfidence"), 0, 1, "requireConfidence")
    if ai.get("persona") not in ("friendly-host", "knowledge-host", "hype-host", "custom"):
        raise ValueError("AI人格无效")
    for field, maximum in (("interactionRule", 2000), ("systemPrompt", 2000), ("streamContext", 500), ("fallbackText", 200)):
        text(ai.get(field), maximum, field)
    if type(ai.get("blockLinks")) is not bool or type(ai.get("blockAds")) is not bool:
        raise ValueError("AI风控开关无效")
    blocked = ai.get("blockedKeywords")
    if not isinstance(blocked, list) or len(blocked) > 100:
        raise ValueError("AI禁用词无效")
    for keyword in blocked:
        text(keyword, 50, "AI禁用词")
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
        else:
            policy = {**defaults[key], **policy, "output": {**defaults[key]["output"], **(policy.get("output") or {})}}
            scenes[key] = policy
        if type(policy.get("enabled")) is not bool:
            raise ValueError(f"{key} 场景无效")
        output(policy.get("output"), key)
        if "template" not in policy:
            policy["template"] = defaults[key]["template"]
        text(policy.get("template"), 300, "播报内容")
        text(policy.get("prefix"), 100, "场景前缀")
        for field, low, high in (("priority", 0, 3), ("maxLength", 20, 1000), ("cooldownMs", 0, 60000)):
            number(policy.get(field), low, high, field, True)
        normalized_scenes[key] = copy.deepcopy(policy)
    result = copy.deepcopy(default_voice_config())
    result.update(copy.deepcopy(data))
    result["scenes"] = normalized_scenes
    result["chat"] = {**default_voice_config()["chat"], **copy.deepcopy(chat)}
    result["aiInteraction"] = {**default_voice_config()["aiInteraction"], **copy.deepcopy(ai)}
    return result
