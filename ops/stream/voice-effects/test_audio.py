"""Exercise actual local speech recognition using synthesized PCM, without OBS/network."""
import json
from pathlib import Path
import subprocess
import unittest

from vosk import Model, KaldiRecognizer, SetLogLevel
from core import KeywordGate


class AudioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        SetLogLevel(-1)
        cls.model = Model(str(Path.home() / ".cache/tolley-voice/vosk-model-small-en-us-0.15"))

    def recognize(self, source):
        pcm = subprocess.check_output(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", source,
            "-af", "apad=pad_dur=3", "-ar", "16000", "-ac", "1", "-f", "s16le", "pipe:1"])
        r = KaldiRecognizer(self.model, 16000)
        r.SetWords(True)
        gate = KeywordGate()
        cues = []
        for offset in range(0, len(pcm), 4000):
            if r.AcceptWaveform(pcm[offset:offset+4000]):
                cue = gate.recognize(json.loads(r.Result()), True)
                if cue:
                    cues.append(cue)
        return cues

    def test_plural_two_voices(self):
        for voice in ("slt", "rms"):
            with self.subTest(voice=voice):
                self.assertEqual(self.recognize(f"flite=text=Fireworks.:voice={voice}"), ["fireworks"])

    def test_singular(self):
        self.assertEqual(self.recognize("flite=text=Firework.:voice=slt"), ["firework"])

    def test_sales_talk_and_similar_words(self):
        for phrase in ("We have a toaster and a coffee maker.", "This fireplace works really well."):
            with self.subTest(phrase=phrase):
                self.assertEqual(self.recognize(f"flite=text={phrase}:voice=slt"), [])

    def test_silence(self):
        self.assertEqual(self.recognize("anullsrc=r=16000:cl=mono:d=3"), [])


if __name__ == "__main__":
    unittest.main()
