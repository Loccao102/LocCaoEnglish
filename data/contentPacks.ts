export type SentenceRound={chunks:string[];answer:string};
export type GrammarRound={prompt:string;answer:string;options:string[]};
export type CollocationRound={core:string;answer:string;options:string[]};
export type ListeningRound={audio:string;q:string;answer:string;options:string[]};
export type WordLinkRound={word:string;relation:string;answer:string;options:string[];note:string};
export type LearningPack={label:string;sentenceRounds:SentenceRound[];grammarRounds:GrammarRound[];collocations:CollocationRound[];listeningRounds:ListeningRound[];speakingPrompts:string[];wordLinkRounds:WordLinkRound[]};
type PackOverride=Partial<Omit<LearningPack,"label">>&{label:string};

const base:LearningPack={
 label:"CORE ENGLISH",
 sentenceRounds:[
  {chunks:["because","public transport","is","more sustainable","I prefer","it"],answer:"I prefer public transport because it is more sustainable"},
  {chunks:["had already left","when","the gate","I arrived at","the flight"],answer:"The flight had already left when I arrived at the gate"},
  {chunks:["people","who work remotely","often value","flexible schedules"],answer:"People who work remotely often value flexible schedules"},
 ],
 grammarRounds:[
  {prompt:"Choose the grammatically correct sentence.",answer:"Many people believe that public transport should be improved.",options:["Many people believes that public transport should be improved.","Many people believe that public transport should be improved.","Many people believing public transport should improved."]},
  {prompt:"Repair the conditional.",answer:"If I had left earlier, I would not have missed the flight.",options:["If I left earlier, I would not missed the flight.","If I had left earlier, I would not have missed the flight.","If I have left earlier, I would not missed the flight."]},
  {prompt:"Choose the natural relative clause.",answer:"The hotel that we booked was close to the station.",options:["The hotel what we booked was close to station.","The hotel that we booked was close to the station.","The hotel we booked it was close to the station."]},
 ],
 collocations:[
  {core:"make",answer:"a decision",options:["a decision","a rain","a traffic","a research"]},
  {core:"highly",answer:"effective",options:["effective","rain","traffic","journey"]},
  {core:"pose",answer:"a threat",options:["a threat","a homework","a transport","a weather"]},
 ],
 listeningRounds:[
  {audio:"Attention passengers. Flight VN218 to Da Nang will now depart from gate twelve instead of gate eight.",q:"What changed?",answer:"The departure gate",options:["The destination","The departure gate","The flight number","The airline"]},
  {audio:"The museum closes at six, but the last guided tour begins at four thirty in the afternoon.",q:"When does the last guided tour begin?",answer:"4:30 p.m.",options:["4:00 p.m.","4:30 p.m.","5:30 p.m.","6:00 p.m."]},
  {audio:"Due to engineering work, trains to Oxford will leave from platform six until noon, then return to platform three.",q:"Where do Oxford trains leave from before noon?",answer:"Platform six",options:["Platform three","Platform four","Platform six","Platform nine"]},
 ],
 speakingPrompts:["Could I have a window seat, please?","I usually prefer travelling by train because it is more comfortable.","One of the main reasons people move to large cities is the availability of better job opportunities."],
 wordLinkRounds:[
  {word:"significant",relation:"Choose the closest synonym",answer:"substantial",options:["minor","substantial","temporary","ordinary"],note:"Significant and substantial can both describe something large or important in degree."},
  {word:"increase",relation:"Choose a natural collocation",answer:"increase dramatically",options:["increase loudly","increase dramatically","increase politely","increase softly"],note:"Dramatically is a common adverb with increase."},
  {word:"scarce",relation:"Choose the antonym",answer:"abundant",options:["rare","limited","abundant","insufficient"],note:"Scarce means limited; abundant means plentiful."},
  {word:"benefit",relation:"Choose the strongest word-family link",answer:"beneficial",options:["beneficial","beautiful","beneath","belief"],note:"Beneficial is the related adjective."},
  {word:"allocate",relation:"Choose the best meaning",answer:"distribute for a purpose",options:["remove completely","distribute for a purpose","speak uncertainly","compare two objects"],note:"Allocate means assign resources for a purpose."},
 ]
};

const packs:Record<string,PackOverride>={
 "travel-airport":{label:"TRAVEL · AIRPORT",wordLinkRounds:[
  {word:"boarding pass",relation:"Choose what it lets you do",answer:"board the flight",options:["claim baggage","board the flight","exchange money","book a hotel"],note:"A boarding pass is the document used to enter the aircraft."},
  {word:"gate",relation:"Choose the closest airport meaning",answer:"departure point",options:["departure point","passport stamp","seat class","baggage weight"],note:"At an airport, the gate is the departure point for boarding."},
  {word:"rebook",relation:"Choose the best meaning",answer:"book a replacement journey",options:["cancel all travel","book a replacement journey","check a suitcase","change currency"],note:"Rebook means arrange another booking, often after disruption."},
  {word:"miss",relation:"Choose the natural collocation",answer:"miss a flight",options:["miss a flight","miss a luggage","miss a passport","miss a gate number"],note:"Miss a flight is the natural collocation when you arrive too late."},
  {word:"connection",relation:"Choose the travel meaning",answer:"a linked onward flight",options:["a linked onward flight","a security officer","a seat upgrade","a baggage label"],note:"A connection is an onward flight linked to your journey."},
 ],listeningRounds:[
  {audio:"Passengers for flight LC218 should proceed to gate C12. Boarding begins at seven oh five, twenty minutes earlier than scheduled.",q:"What should the passenger remember?",answer:"Gate C12 and 7:05 boarding",options:["Gate C12 and 7:05 boarding","Gate C7 and 7:20 boarding","Baggage claim C12","Check-in closes at 7:05"]},
  {audio:"Your replacement flight leaves at seven forty and has one short connection in Singapore.",q:"What is special about the replacement flight?",answer:"It has one connection",options:["It is direct","It has one connection","It leaves tomorrow","It has no seats"]},
 ],speakingPrompts:["I missed my flight. Could you help me rebook, please?","I would prefer the earliest available flight, even if it has a short connection.","Could you confirm the gate and the boarding time for me?"]},
 "travel-hotel":{label:"TRAVEL · HOTEL",grammarRounds:[
  {prompt:"Choose the most natural polite request.",answer:"Could you check the reservation number again, please?",options:["You check reservation again.","Could you check the reservation number again, please?","Can checking my reservation now?"]},
  {prompt:"Repair the present perfect sentence.",answer:"I have already received a confirmation email.",options:["I already receive a confirmation email.","I have already received a confirmation email.","I have already receive confirmation email."]},
  {prompt:"Choose the natural indirect question.",answer:"Could you tell me whether breakfast is included?",options:["Could you tell me is breakfast included?","Could you tell me whether breakfast is included?","Tell me whether is breakfast included?"]},
 ],speakingPrompts:["I have a confirmed reservation, but I think it may be under my middle name.","Could you check this confirmation number again, please?","Could you tell me whether breakfast is included and what time checkout is?"]},
 "travel-transit":{label:"TRAVEL · TRANSIT",collocations:[
  {core:"change",answer:"lines",options:["lines","tickets","stations late","a platform number"]},
  {core:"last",answer:"train",options:["train","route quickly","ticket office","platform map"]},
  {core:"valid",answer:"ticket",options:["ticket","traffic","station","direction"]},
 ],listeningRounds:[
  {audio:"The last green-line train leaves Central at eleven twenty. Passengers from the blue line should change at platform four.",q:"Where should blue-line passengers change?",answer:"Platform four",options:["Platform two","Platform four","Platform seven","At the ticket office"]},
  {audio:"Because of maintenance, trains toward Riverside will skip East Market tonight.",q:"Which stop will be skipped?",answer:"East Market",options:["Central","Riverside","East Market","West Park"]},
 ],speakingPrompts:["What is the fastest route to Central Station?","Where do I change from the blue line to the green line?","Which platform do I need, and how many minutes do I have before the last train?"]},
 "conversation-cafe":{label:"CONVERSATION · CAFE",collocations:[
  {core:"nice to",answer:"meet you",options:["meet you","see a coffee","know your name","talk a seat"]},
  {core:"come here",answer:"often",options:["often","friendly","coffee","weekend plan"]},
  {core:"keep in",answer:"touch",options:["touch","talking","meeting","question"]},
 ],listeningRounds:[
  {audio:"I work nearby, but I usually come to this cafe after class because it is quieter in the evening.",q:"Why does the speaker come in the evening?",answer:"It is quieter",options:["It is cheaper","It is quieter","It closes later","Friends work there"]},
  {audio:"I am really into badminton and films, but lately I have been learning photography too.",q:"What new interest does the speaker mention?",answer:"Photography",options:["Badminton","Films","Photography","Cooking"]},
 ],speakingPrompts:["Hi, my name is Loc. I don't think we've met before.","What about you? What do you usually do after work or class?","It was nice to meet you. Would you like to grab coffee again sometime?"]},
 "conversation-plans":{label:"CONVERSATION · MAKE PLANS",sentenceRounds:[
  {chunks:["going to the cinema","How about","on Saturday"],answer:"How about going to the cinema on Saturday"},
  {chunks:["at three o'clock","We could meet","near the lake","at the cafe"],answer:"We could meet at the cafe near the lake at three o'clock"},
  {chunks:["then","Sounds good","see you","I'll"],answer:"Sounds good I'll see you then"},
 ],listeningRounds:[
  {audio:"Saturday afternoon works for me, but I need to leave before six because I have dinner with my family.",q:"What restriction does the speaker have?",answer:"They must leave before six",options:["They cannot meet Saturday","They must leave before six","They need to meet at six","They have work all day"]},
  {audio:"Let's meet outside the cinema at three fifteen rather than at the cafe, because the cafe gets crowded.",q:"Where will they meet?",answer:"Outside the cinema",options:["Inside the cafe","At the station","Outside the cinema","Near the lake"]},
 ],speakingPrompts:["How about going to the cinema this Saturday?","Would three o'clock at the cafe near the lake work for you?","Perfect. So we meet there at three. See you then."]},
 "conversation-clarity":{label:"CONVERSATION · CLARITY",grammarRounds:[
  {prompt:"Choose the most natural clarification.",answer:"Sorry, I'm not sure what you mean. Could you explain that again?",options:["Sorry, I'm not sure what you mean. Could you explain that again?","I don't understand you meaning.","Explain again because wrong."]},
  {prompt:"Choose the clearest rephrase.",answer:"What I mean is that I may arrive later, not that I am cancelling.",options:["I mean later not cancel maybe.","What I mean is that I may arrive later, not that I am cancelling.","My meaning is no cancel but late."]},
  {prompt:"Choose the natural confirmation.",answer:"So you mean the plan is still on, but the time may change?",options:["So you mean the plan is still on, but the time may change?","You mean plan still but time?","So the time change plan yes?"]},
 ],collocations:[
  {core:"clear up",answer:"a misunderstanding",options:["a misunderstanding","a sentence loudly","a meeting time fast","a grammar"]},
  {core:"rephrase",answer:"an idea",options:["an idea","a listener","a coffee","a schedule late"]},
  {core:"make yourself",answer:"clear",options:["clear","understand","meaning","repeat"]},
 ],speakingPrompts:["Sorry, I'm not sure what you mean. Could you explain that again?","What I mean is that I may arrive later, not that I am cancelling.","Got it. So the plan is still on, but the time may change."]},
 "work-standup":{label:"WORK · STAND-UP",sentenceRounds:[
  {chunks:["the login bug","Yesterday","I fixed"],answer:"Yesterday I fixed the login bug"},
  {chunks:["Today","integration tests","I will add"],answer:"Today I will add integration tests"},
  {chunks:["no blockers","I have","right now"],answer:"I have no blockers right now"},
 ],collocations:[
  {core:"fix",answer:"a bug",options:["a bug","a deadline","a meeting","a blocker person"]},
  {core:"run",answer:"tests",options:["tests","a requirement","a code review late","a progress"]},
  {core:"raise",answer:"a blocker",options:["a blocker","a feature done","a stand-up","a branch fast"]},
 ],speakingPrompts:["Yesterday I finished the authentication fix.","Today I will add integration tests and review the API changes.","I have no blockers right now, but I may need the product owner to confirm one edge case."]},
 "work-requirements":{label:"WORK · REQUIREMENTS",grammarRounds:[
  {prompt:"Choose the clearest clarification question.",answer:"What exactly should happen when the search returns no results?",options:["What exactly should happen when the search returns no results?","What happen search no result?","Should what happen no results?"]},
  {prompt:"Choose the natural confirmation.",answer:"So the requirement is to show suggestions when there are no exact matches, correct?",options:["So requirement suggestions no match correct?","So the requirement is to show suggestions when there are no exact matches, correct?","The requirement is suggestions when not match is it?"]},
  {prompt:"Repair the ambiguity statement.",answer:"The phrase 'better results' is unclear because it does not define the ranking rule.",options:["Better results unclear because no ranking rule define.","The phrase 'better results' is unclear because it does not define the ranking rule.","Better results is not clarity ranking."]},
 ],listeningRounds:[
  {audio:"For this release, faster means the common search results should appear within one second, and exact title matches should rank first.",q:"What is the response-time target?",answer:"Within one second",options:["Within half a second","Within one second","Within three seconds","No target was given"]},
  {audio:"If there are no exact matches, show up to five related suggestions rather than an empty state.",q:"What should happen when there is no exact match?",answer:"Show up to five related suggestions",options:["Show an error","Show up to five related suggestions","Reload automatically","Hide the search box"]},
 ],speakingPrompts:["The phrase 'better results' is unclear. Could we define what ranking behavior we expect?","What exactly should happen when a search returns no exact matches?","So the acceptance condition is one-second response time and exact title matches ranked first, correct?"]},
 "work-deadline":{label:"WORK · DELIVERY",sentenceRounds:[
  {chunks:["creates","a testing risk","The Friday deadline"],answer:"The Friday deadline creates a testing risk"},
  {chunks:["we reduce scope","quality","We can protect","if"],answer:"We can protect quality if we reduce scope"},
  {chunks:["on Friday","the core flow","I propose","delivering"],answer:"I propose delivering the core flow on Friday"},
 ],grammarRounds:[
  {prompt:"Choose the calmest constraint statement.",answer:"I can commit to Friday for the core flow, but the full scope would put testing at risk.",options:["Friday is impossible and I won't do it.","I can commit to Friday for the core flow, but the full scope would put testing at risk.","Maybe Friday but testing no."]},
  {prompt:"Choose the clearest trade-off.",answer:"If we keep the full scope, we either need more time or we reduce the testing window.",options:["If full scope then something must change.","If we keep the full scope, we either need more time or we reduce the testing window.","Full scope means testing bad maybe."]},
 ],collocations:[
  {core:"meet",answer:"a deadline",options:["a deadline","a risk","a scope","a testing"]},
  {core:"reduce",answer:"scope",options:["scope","a deadline meet","a release date long","a blocker"]},
  {core:"phased",answer:"delivery",options:["delivery","deadline","testing risk","priority task"]},
 ],speakingPrompts:["The Friday deadline creates a testing risk for the full scope.","If we keep the quality bar, reducing scope is the safer trade-off.","I propose a phased delivery: the core flow on Friday and reporting in the next release."]}
};

export function getLearningPack(key?:string):LearningPack{const selected=key?packs[key]:undefined;return {...base,...selected,label:selected?.label??base.label}}
