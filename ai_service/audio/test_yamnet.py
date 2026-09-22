"""Optional real-model smoke test, no downloads during collection."""

import os
import unittest
from pathlib import Path


class YAMNetIntegrationTest(unittest.TestCase):
    @unittest.skipUnless(
        os.getenv("RUN_MODEL_TESTS") == "1",
        "Set RUN_MODEL_TESTS=1 and YAMNET_MODEL_PATH for real inference",
    )
    def test_repository_fixture(self):
        from ai_service.audio.yamnet_classifier import classifier
        from backend.media import decode_audio

        classifier.initialize()
        self.assertIsNotNone(classifier.model)
        result = classifier.predict(
            decode_audio(Path(__file__).with_name("test.wav").read_bytes())
        )
        self.assertTrue(0 <= result.confidence <= 1)


if __name__ == "__main__":
    unittest.main()
