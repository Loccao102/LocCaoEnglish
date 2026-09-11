import unittest

from app.main import (
    ConversationRequest,
    ExerciseRequest,
    WritingRequest,
    local_conversation,
    local_exercises,
    local_writing_score,
)


class FallbackEngineTests(unittest.TestCase):
    def test_writing_score_has_four_criteria(self):
        result = local_writing_score(WritingRequest(essay=("Public transport can reduce congestion and pollution. " * 20), task="Discuss transport investment."))
        self.assertEqual(len(result["criteria"]), 4)
        self.assertIn("overall", result)

    def test_generator_returns_requested_count(self):
        result = local_exercises(ExerciseRequest(skill="Speaking", topic="travel", level="B1", count=6))
        self.assertEqual(len(result["items"]), 6)

    def test_airport_conversation_advances_objective(self):
        result = local_conversation(ConversationRequest(message="I missed my flight. Can you help me rebook?", scenario="airport", level="B1"))
        self.assertIn("rebook", result["reply"].lower())
        self.assertTrue(result["objective"])


if __name__ == "__main__":
    unittest.main()
