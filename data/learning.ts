export type LearningSkill = { name: string; level: number; confidence: number; tone: "strong" | "medium" | "weak" };
export const skills: LearningSkill[] = [
  { name:"Vocabulary",level:18,confidence:82,tone:"strong" },{ name:"Grammar",level:13,confidence:61,tone:"medium" },{ name:"Listening",level:15,confidence:74,tone:"strong" },{ name:"Speaking",level:9,confidence:48,tone:"weak" },{ name:"Reading",level:16,confidence:78,tone:"strong" },{ name:"Writing",level:8,confidence:44,tone:"weak" },{ name:"Dictation",level:11,confidence:56,tone:"medium" },
];
export const dailyQuests=[{label:"Learn 10 travel words",done:true,xp:20},{label:"Complete 5 dictation lines",done:true,xp:25},{label:"Shadow 3 speaking prompts",done:false,xp:30},{label:"Play one Word Link round",done:false,xp:20},{label:"Review weak items",done:false,xp:25}];
export const games=[
{slug:"word-link",href:"/games/word-link",icon:"◎",name:"Word Link",description:"Connect meaning, synonym, antonym and collocation.",skill:"Vocabulary",minutes:5},
{slug:"word-graph",href:"/word-graph",icon:"◇",name:"Word Graph",description:"Explore and test a visual vocabulary knowledge graph.",skill:"Vocabulary",minutes:7},
{slug:"collocation-factory",href:"/games/collocation-factory",icon:"⚙",name:"Collocation Factory",description:"Build natural English combinations under pressure.",skill:"Vocabulary",minutes:5},
{slug:"sentence-builder",href:"/games/sentence-builder",icon:"▦",name:"Sentence Builder",description:"Rebuild natural sentence patterns from shuffled chunks.",skill:"Grammar",minutes:6},
{slug:"grammar-repair",href:"/games/grammar-repair",icon:"⌁",name:"Grammar Repair",description:"Find the broken pattern and repair the sentence.",skill:"Grammar",minutes:6},
{slug:"reading",href:"/reading",icon:"↯",name:"Reading Race",description:"Skim, scan and answer evidence-based questions.",skill:"Reading",minutes:8},
{slug:"story-choice",href:"/games/story-choice",icon:"◫",name:"Story Choice",description:"Read, choose natural responses and change the story.",skill:"Reading",minutes:7},
{slug:"listening",href:"/listening",icon:"◖",name:"Listen & Pick",description:"Listen for key details in short announcements.",skill:"Listening",minutes:6},
{slug:"dictation",href:"/dictation",icon:"⌨",name:"Dictation Rush",description:"Listen, type, compare and collect weak language.",skill:"Dictation",minutes:7},
{slug:"speaking",href:"/speaking",icon:"◉",name:"Shadow Me",description:"Listen, repeat and get transcript-based coaching.",skill:"Speaking",minutes:6},
{slug:"ielts",href:"/ielts",icon:"✦",name:"IELTS Lab",description:"Practice writing with four-criterion feedback.",skill:"Writing",minutes:12},
{slug:"airport-boss",href:"/missions/airport",icon:"♜",name:"Airport Boss",description:"Combine four skills in a real-world AI conversation mission.",skill:"Mixed",minutes:15},
];
