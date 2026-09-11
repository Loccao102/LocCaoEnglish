import unittest
from app.main import ConversationRequest,ExerciseRequest,WritingRequest,local_conversation,local_exercises,local_writing_score
class FallbackEngineTests(unittest.TestCase):
    def test_writing_score_has_four_criteria(self):
        result=local_writing_score(WritingRequest(essay=("Public transport can reduce congestion and pollution. "*20),task="Discuss transport investment."));self.assertEqual(len(result["criteria"]),4);self.assertIn("overall",result)
    def test_generator_returns_requested_count(self):
        result=local_exercises(ExerciseRequest(skill="Speaking",topic="travel",level="B1",count=6));self.assertEqual(len(result["items"]),6)
    def test_airport_conversation_advances_objective(self):
        result=local_conversation(ConversationRequest(message="I missed my flight. Can you help me rebook?",scenario="airport",level="B1"));self.assertIn("rebook",result["reply"].lower())
    def test_hotel_conversation_finds_booking(self):
        result=local_conversation(ConversationRequest(message="My reservation cannot be found.",scenario="hotel",level="B1"));self.assertIn("confirmation",result["reply"].lower())
    def test_transit_conversation_gives_route_choice(self):
        result=local_conversation(ConversationRequest(message="I need to get to Central Station before the last train.",scenario="transit",level="B1"));self.assertIn("route",result["reply"].lower())
    def test_cafe_conversation_reacts_to_introduction(self):
        result=local_conversation(ConversationRequest(message="Hi, my name is Loc.",scenario="cafe",level="B1"));self.assertIn("nice to meet",result["reply"].lower())
    def test_plans_conversation_negotiates_details(self):
        result=local_conversation(ConversationRequest(message="How about going to the cinema?",scenario="plans",level="B1"));self.assertIn("when",result["reply"].lower())
    def test_misunderstanding_requests_rephrase(self):
        result=local_conversation(ConversationRequest(message="Sorry, I didn't understand what you mean.",scenario="misunderstanding",level="B1"));self.assertIn("explain",result["reply"].lower())
if __name__=="__main__":unittest.main()
