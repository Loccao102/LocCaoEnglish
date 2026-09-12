from typing import Any


def roleplay_reply(message: str, scenario: str, history: list[dict[str, str]] | None = None) -> dict[str, Any]:
    text = message.lower().strip()
    scenario = scenario.lower().strip()
    history = history or []

    if scenario == "airport":
        if any(x in text for x in ["gate", "boarding", "board"]):
            reply = "Exactly. Your flight boards at gate C12 at 7:05 p.m. You are all set — have a safe trip."
            objective = "Mission communication complete."
        elif any(x in text for x in ["missed", "late", "delay", "miss my"]):
            reply = "I’m sorry about that. I can help you rebook. Do you prefer the earliest available flight or a later one?"
            objective = "Ask for a replacement and state a preference."
        elif any(x in text for x in ["earliest", "next flight", "another flight", "rebook", "prefer"]):
            reply = "The earliest option leaves at 7:40 p.m. There is one seat left, but it has a short connection. Would you like me to book it?"
            objective = "Accept or reject the option clearly."
        elif any(x in text for x in ["yes", "book", "take it"]):
            reply = "Done. Your new boarding pass is ready. Before you go, can you confirm which gate you should head to and when boarding starts?"
            objective = "Confirm the gate and boarding time."
        else:
            reply = "Good afternoon. How can I help you with your flight today?"
            objective = "Explain the flight problem."

    elif scenario == "hotel":
        if any(x in text for x in ["breakfast", "checkout", "check-out", "wifi", "wi-fi", "key card", "please", "could you"]):
            reply = "Certainly. Breakfast starts at seven, checkout is at eleven, and the Wi-Fi password is on your key sleeve. Your room is ready."
            objective = "Mission communication complete."
        elif any(x in text for x in ["confirmation number", "booking number", "email", "under my name", "middle name"]):
            reply = "Thank you. I found the reservation under your middle name. The room is available. Is there anything practical you would like to confirm before I issue the key?"
            objective = "Ask one practical question about the stay."
        elif any(x in text for x in ["reservation", "booking", "booked", "cannot find", "can't find"]):
            reply = "I’m sorry, I still can’t see it under that name. Do you have the confirmation number or the email address used for the reservation?"
            objective = "Provide one booking detail and ask me to check again."
        else:
            reply = "Good evening. Welcome to the Meridian Hotel. How can I help you?"
            objective = "Explain the missing reservation."

    elif scenario == "transit":
        if any(x in text for x in ["platform", "ticket", "minutes", "what time", "blue line", "green line"]):
            reply = "Correct. Change at Central, follow signs for platform four, and you should make the last green-line train with several minutes to spare."
            objective = "Mission communication complete."
        elif any(x in text for x in ["fastest", "route", "transfer", "change", "line", "fewer transfers"]):
            reply = "For the fastest route, take the blue line to Central and change to the green line at platform four. The last train leaves in eighteen minutes."
            objective = "Confirm one platform, ticket, or timing detail."
        elif any(x in text for x in ["station", "train", "metro", "get to", "go to", "last train", "need to go"]):
            reply = "You can still make it. Do you want the fastest route or the route with fewer transfers?"
            objective = "Ask for or choose a route."
        else:
            reply = "Hello. Where are you trying to get to tonight?"
            objective = "Explain your destination or last-train problem."

    elif scenario == "cafe":
        if any(x in text for x in ["nice to meet", "good to meet", "see you", "would you like", "can we", "talk again"]):
            reply = "I'd like that. It was really nice meeting you — maybe we can grab coffee again next week."
            objective = "Mission communication complete."
        elif any(x in text for x in ["what about you", "where are you", "what do you", "do you like", "how about you"]):
            reply = "I work nearby and I come here when I need a quiet break. I’m really into films and badminton. What do you usually do after work or class?"
            objective = "Keep the connection going or close it naturally."
        elif any(x in text for x in ["i'm ", "i am ", "my name is", "call me"]):
            reply = "Nice to meet you. I’m Minh. Is this your first time at this cafe, or do you come here often?"
            objective = "Show curiosity by asking me a genuine question."
        else:
            reply = "Hey, is this seat free? I don't think we've met before."
            objective = "Introduce yourself."

    elif scenario == "plans":
        if any(x in text for x in ["sounds good", "see you", "so we meet", "it's a plan", "perfect", "confirmed"]):
            reply = "Perfect — Saturday at three at the cafe near the lake. I’ll see you there."
            objective = "Mission communication complete."
        elif any(x in text for x in ["saturday", "sunday", "tomorrow", "meet at", "cafe", "park", "where should", " at "]):
            reply = "Saturday works for me. How about three o’clock at the cafe near the lake?"
            objective = "Confirm the final time and place."
        elif any(x in text for x in ["let's", "how about", "would you like", "we could", "why don't we"]):
            reply = "That sounds fun. I’m interested. When would you like to go, and where should we meet?"
            objective = "Agree on a time or place."
        else:
            reply = "I'm free this weekend, but I haven't decided what to do yet. Any ideas?"
            objective = "Make a suggestion."

    elif scenario == "misunderstanding":
        if any(x in text for x in ["so you mean", "got it", "i understand", "that makes sense", "okay now", "now i understand"]):
            reply = "Exactly — that’s what I meant. Thanks for checking instead of guessing. We’re on the same page now."
            objective = "Mission communication complete."
        elif any(x in text for x in ["what i mean", "in other words", "i meant", "let me explain", "to clarify"]):
            reply = "Ah, I see. So you’re not cancelling — you’re saying you may arrive later. Is that right?"
            objective = "Confirm that we now share the same meaning."
        elif any(x in text for x in ["sorry", "didn't understand", "did not understand", "what do you mean", "not sure what you mean"]):
            reply = "No problem. I meant that I thought the whole plan was cancelled, not just delayed. Can you explain what you intended?"
            objective = "Rephrase what you meant in a different way."
        else:
            reply = "Wait — I thought you said you were cancelling the plan completely. Is that what you meant?"
            objective = "Politely signal the misunderstanding."

    elif scenario == "standup":
        if any(x in text for x in ["blocker", "blocked", "need help", "dependency", "no blockers", "not blocked"]):
            reply = "Good — that gives the team enough to act. I know what moved, what you’re doing next, and whether anyone needs to unblock you."
            objective = "Mission communication complete."
        elif any(x in text for x in ["today", "next", "i will", "i'll", "plan to"]):
            reply = "Clear. Before we move on, is anything blocking that plan or do you need a dependency from someone else?"
            objective = "State a blocker or explicitly say there are no blockers."
        elif any(x in text for x in ["yesterday", "finished", "completed", "worked on", "done"]):
            reply = "Thanks. What is the next concrete thing you will work on today?"
            objective = "State the next action."
        else:
            reply = "Morning. Give me your update: what changed since yesterday?"
            objective = "Report one concrete piece of recent progress."

    elif scenario == "requirements":
        if any(x in text for x in ["so the requirement", "acceptance", "confirm that", "understood", "so it should", "that means"]):
            reply = "Yes, that captures it. We now have a testable expectation instead of 'make it better'. You can proceed with that acceptance condition."
            objective = "Mission communication complete."
        elif any(x in text for x in ["should", "which", "what happens", "do you mean", "what exactly", "when should", "does this"]):
            reply = "Good question. For this release, 'faster' means results should appear within one second for the common query set, and ranking should prioritise exact title matches."
            objective = "Restate and confirm the acceptance condition."
        elif any(x in text for x in ["not clear", "unclear", "clarify", "understand the requirement", "ambiguous"]):
            reply = "Fair point. Which part would you like to pin down first: response time, ranking quality, or both?"
            objective = "Ask one concrete clarifying question."
        else:
            reply = "We need the search page to feel faster and show better results. Can you take care of it?"
            objective = "Identify what is ambiguous before committing."

    elif scenario == "deadline":
        if any(x in text for x in ["could deliver", "extend", "phase", "phased", "mvp", "option", "instead", "propose"]):
            reply = "That is a workable proposal. Ship the core path Friday, keep the full regression suite, and move the secondary reporting screen to the next slice."
            objective = "Mission communication complete."
        elif any(x in text for x in ["deadline", "timeline", "cannot", "can't", "risk", "not enough time"]):
            reply = "I hear the constraint. Make the trade-off explicit: what would we have to sacrifice to force the full scope into Friday?"
            objective = "Explain one trade-off clearly."
        elif any(x in text for x in ["scope", "quality", "testing", "resource", "priority", "trade-off", "tradeoff"]):
            reply = "Understood. If we refuse to cut testing, what alternative would you propose for Friday — smaller scope, phased delivery, or a later date?"
            objective = "Propose one concrete alternative."
        else:
            reply = "I need the full feature in production by Friday. Can you commit to that?"
            objective = "State the delivery constraint without sounding defensive."

    else:
        reply = "Tell me a little more so I can respond naturally in this role-play."
        objective = "Continue the conversation with a complete sentence."

    return {"provider": "scenario-engine", "reply": reply, "objective": objective, "correction": None}
