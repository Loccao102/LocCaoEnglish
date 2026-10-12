export const missionConfigs = {
  "airport": {
    "bossId": "airport-crisis",
    "world": "TRAVEL",
    "campaignRoute": "/travel",
    "eyebrow": "CHAPTER 1 · AIRPORT",
    "title": "You missed your flight.",
    "copy": "Build the three checkpoint skills, then negotiate a rebooking with the airline desk.",
    "agent": "Airline service desk",
    "intro": "Good afternoon. How can I help you with your flight today?",
    "objective": "Explain that you missed your flight and ask to be rebooked.",
    "reward": "Airport Wings"
  },
  "hotel": {
    "bossId": "hotel-reservation",
    "world": "TRAVEL",
    "campaignRoute": "/travel",
    "eyebrow": "CHAPTER 2 · HOTEL",
    "title": "Your reservation is missing.",
    "copy": "Read the situation, repair polite requests, then solve the booking problem with the night receptionist.",
    "agent": "Hotel night desk",
    "intro": "Good evening. Welcome to the Meridian Hotel. How can I help you?",
    "objective": "Explain that you have a confirmed reservation but the hotel cannot find it.",
    "reward": "Hotel Diplomat title"
  },
  "transit": {
    "bossId": "city-transit",
    "world": "TRAVEL",
    "campaignRoute": "/travel",
    "eyebrow": "CHAPTER 3 · CITY TRANSIT",
    "title": "The last train is leaving.",
    "copy": "Build transit language, catch platform information, then find a valid route across the city before service ends.",
    "agent": "Metro information desk",
    "intro": "Hello. Where are you trying to get to tonight?",
    "objective": "Say where you need to go and ask for the fastest route before the last train.",
    "reward": "City Navigator Frame + Passport Aura"
  },
  "cafe": {
    "bossId": "cafe-connection",
    "world": "CONVERSATION",
    "campaignRoute": "/conversation",
    "eyebrow": "CHAPTER 1 · CAFE",
    "title": "Break the ice.",
    "copy": "Start a natural conversation with someone new instead of answering isolated speaking prompts.",
    "agent": "Cafe regular",
    "intro": "Hey, is this seat free? I don't think we've met before.",
    "objective": "Introduce yourself and keep the conversation moving with a genuine question.",
    "reward": "Social Spark badge"
  },
  "plans": {
    "bossId": "weekend-plans",
    "world": "CONVERSATION",
    "campaignRoute": "/conversation",
    "eyebrow": "CHAPTER 2 · WEEKEND",
    "title": "Turn small talk into a plan.",
    "copy": "Suggest an activity, negotiate time and place, then confirm exactly what happens next.",
    "agent": "New friend",
    "intro": "I'm free this weekend, but I haven't decided what to do yet. Any ideas?",
    "objective": "Suggest something you could do together.",
    "reward": "Plan Maker title"
  },
  "misunderstanding": {
    "bossId": "repair-misunderstanding",
    "world": "CONVERSATION",
    "campaignRoute": "/conversation",
    "eyebrow": "CHAPTER 3 · CLARITY",
    "title": "Repair the misunderstanding.",
    "copy": "Stay in the conversation when meaning breaks down: clarify, rephrase and confirm shared understanding.",
    "agent": "Conversation partner",
    "intro": "Wait — I thought you said you were cancelling the plan completely. Is that what you meant?",
    "objective": "Politely signal the misunderstanding and clarify what you actually meant.",
    "reward": "Conversation Frame + Clarity Aura"
  },
  "standup": {
    "bossId": "daily-standup",
    "world": "WORK",
    "campaignRoute": "/work",
    "eyebrow": "CHAPTER 1 · STAND-UP",
    "title": "Give the update that matters.",
    "copy": "Report progress, say what happens next and surface blockers without turning the stand-up into a speech.",
    "agent": "Team lead",
    "intro": "Morning. Give me your update: what changed since yesterday?",
    "objective": "Report one concrete piece of recent progress.",
    "reward": "Stand-up Ready badge"
  },
  "requirements": {
    "bossId": "requirement-clarity",
    "world": "WORK",
    "campaignRoute": "/work",
    "eyebrow": "CHAPTER 2 · REQUIREMENTS",
    "title": "The requirement is ambiguous.",
    "copy": "Do not guess. Identify ambiguity, ask a precise question and confirm the acceptance condition.",
    "agent": "Product owner",
    "intro": "We need the search page to feel faster and show better results. Can you take care of it?",
    "objective": "Point out what is unclear before committing to implementation.",
    "reward": "Requirement Detective title"
  },
  "deadline": {
    "bossId": "deadline-negotiation",
    "world": "WORK",
    "campaignRoute": "/work",
    "eyebrow": "CHAPTER 3 · DELIVERY",
    "title": "The deadline is impossible.",
    "copy": "Explain the constraint, make the trade-off visible and negotiate a concrete alternative.",
    "agent": "Delivery manager",
    "intro": "I need the full feature in production by Friday. Can you commit to that?",
    "objective": "State the delivery constraint without sounding defensive.",
    "reward": "Professional Frame + Delivery Aura"
  }
} as const;

export type MissionScenario = keyof typeof missionConfigs;
