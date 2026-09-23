"""Small, deterministic gate between recognized speech and one visual effect."""
import math
import time

KEYWORDS = frozenset(("firework", "fireworks"))
COOLDOWN = 12.0


def allowed(gate):
    return bool(gate.get("allowed") and gate.get("epoch") and gate.get("micSlot"))


class KeywordGate:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.last_trigger = -math.inf
        self.last_word_end = -1.0

    def reset_audio(self):
        # Vosk timestamps begin again after reconnect; the cooldown does not.
        self.last_word_end = -1.0

    def recognize(self, result, ready):
        if not ready:
            return None
        candidate = None
        words = result.get("result", [])
        normalized = []
        i = 0
        while i < len(words):
            word = words[i]
            # The small English model can spell the singular compound as two words.
            if word.get("word") == "fire" and i+1 < len(words):
                following = words[i+1]
                gap = following.get("start", math.inf) - word.get("end", -math.inf)
                if following.get("word") == "work" and 0 <= gap <= .12:
                    word = {**following, "word": "firework", "conf": min(word.get("conf", 0), following.get("conf", 0))}
                    i += 1
            normalized.append(word)
            i += 1
        for word in normalized:
            end = word.get("end", -1)
            confidence = word.get("conf", 0)
            if not isinstance(end, (int, float)) or not math.isfinite(end):
                continue
            if end <= self.last_word_end:
                continue
            self.last_word_end = end
            if (word.get("word") in KEYWORDS and isinstance(confidence, (float, int))
                    and math.isfinite(confidence) and confidence >= 0.80):
                candidate = word["word"]
        if candidate and self.clock() - self.last_trigger >= COOLDOWN:
            self.last_trigger = self.clock()
            return candidate
        return None
