export interface DISCQuestion {
  id: number;
  text: string;
  options: { label: string; weights: { D: number; I: number; S: number; C: number } }[];
}

export interface DISCResult {
  primary: "D" | "I" | "S" | "C";
  secondary: "D" | "I" | "S" | "C";
  scores: { D: number; I: number; S: number; C: number };
}

export interface DISCPlaybook {
  type: string;
  label: string;
  communication: string[];
  homeStyle: string[];
  giftIdeas: string[];
  avoid: string[];
}

export const DISC_QUESTIONS: DISCQuestion[] = [
  {
    id: 1,
    text: "When making a big decision, you tend to:",
    options: [
      { label: "Decide quickly and move on", weights: { D: 3, I: 1, S: 0, C: 0 } },
      { label: "Talk it through with others first", weights: { D: 0, I: 3, S: 1, C: 0 } },
      { label: "Take your time and consider everyone's feelings", weights: { D: 0, I: 0, S: 3, C: 1 } },
      { label: "Research all the facts before committing", weights: { D: 0, I: 0, S: 1, C: 3 } },
    ],
  },
  {
    id: 2,
    text: "At a social gathering, you're most likely to:",
    options: [
      { label: "Take charge and organize activities", weights: { D: 3, I: 1, S: 0, C: 0 } },
      { label: "Work the room and meet everyone", weights: { D: 0, I: 3, S: 0, C: 1 } },
      { label: "Stick with a small group of close friends", weights: { D: 0, I: 0, S: 3, C: 1 } },
      { label: "Observe and engage in meaningful one-on-one chats", weights: { D: 1, I: 0, S: 1, C: 3 } },
    ],
  },
  {
    id: 3,
    text: "When facing a conflict, you prefer to:",
    options: [
      { label: "Address it head-on and resolve it fast", weights: { D: 3, I: 0, S: 0, C: 1 } },
      { label: "Use humor and charm to ease tensions", weights: { D: 0, I: 3, S: 1, C: 0 } },
      { label: "Seek compromise so everyone feels heard", weights: { D: 0, I: 1, S: 3, C: 0 } },
      { label: "Analyze the root cause before responding", weights: { D: 1, I: 0, S: 0, C: 3 } },
    ],
  },
  {
    id: 4,
    text: "Your ideal workspace is:",
    options: [
      { label: "Efficient, no distractions, results-focused", weights: { D: 3, I: 0, S: 0, C: 1 } },
      { label: "Open, collaborative, lots of energy", weights: { D: 0, I: 3, S: 1, C: 0 } },
      { label: "Calm, stable, supportive team environment", weights: { D: 0, I: 0, S: 3, C: 1 } },
      { label: "Organized, structured, with clear processes", weights: { D: 0, I: 0, S: 1, C: 3 } },
    ],
  },
  {
    id: 5,
    text: "When shopping for a home, what matters most?",
    options: [
      { label: "Location prestige and investment potential", weights: { D: 3, I: 1, S: 0, C: 0 } },
      { label: "Entertainment spaces and social potential", weights: { D: 0, I: 3, S: 1, C: 0 } },
      { label: "Safe neighborhood, good schools, family-friendly", weights: { D: 0, I: 0, S: 3, C: 1 } },
      { label: "Build quality, inspection reports, value analysis", weights: { D: 1, I: 0, S: 0, C: 3 } },
    ],
  },
  {
    id: 6,
    text: "When receiving bad news, you typically:",
    options: [
      { label: "Immediately start figuring out a fix", weights: { D: 3, I: 0, S: 1, C: 0 } },
      { label: "Call someone to talk it through", weights: { D: 0, I: 3, S: 1, C: 0 } },
      { label: "Need time to process before reacting", weights: { D: 0, I: 0, S: 3, C: 1 } },
      { label: "Want all the details to understand exactly what happened", weights: { D: 0, I: 0, S: 0, C: 3 } },
    ],
  },
  {
    id: 7,
    text: "People would describe you as:",
    options: [
      { label: "Confident, direct, results-driven", weights: { D: 3, I: 0, S: 0, C: 1 } },
      { label: "Fun, enthusiastic, people-person", weights: { D: 0, I: 3, S: 1, C: 0 } },
      { label: "Loyal, patient, dependable", weights: { D: 0, I: 1, S: 3, C: 0 } },
      { label: "Thorough, analytical, detail-oriented", weights: { D: 1, I: 0, S: 0, C: 3 } },
    ],
  },
];

export function scoreDISC(answers: number[]): DISCResult {
  const scores = { D: 0, I: 0, S: 0, C: 0 };

  answers.forEach((optionIndex, questionIndex) => {
    const question = DISC_QUESTIONS[questionIndex];
    if (!question || optionIndex < 0 || optionIndex >= question.options.length) return;
    const weights = question.options[optionIndex].weights;
    scores.D += weights.D;
    scores.I += weights.I;
    scores.S += weights.S;
    scores.C += weights.C;
  });

  const sorted = (Object.entries(scores) as [keyof typeof scores, number][]).sort(
    (a, b) => b[1] - a[1]
  );

  return {
    primary: sorted[0][0],
    secondary: sorted[1][0],
    scores,
  };
}

const PLAYBOOKS: Record<string, DISCPlaybook> = {
  D: {
    type: "D",
    label: "Dominant",
    communication: [
      "Be direct and to the point",
      "Skip small talk — lead with results",
      "Present 2-3 options, not 10",
      "Respect their time — be prepared",
      "Focus on ROI and investment value",
    ],
    homeStyle: [
      "Prestigious neighborhoods",
      "Turnkey / move-in ready",
      "Status features (pool, view, acreage)",
      "Home office or executive spaces",
    ],
    giftIdeas: [
      "High-end closing gift (branded item, exclusive experience)",
      "Power tools / home improvement gift card",
      "Business book or executive desk accessory",
    ],
    avoid: [
      "Don't waste their time with chitchat",
      "Don't be wishy-washy — have a recommendation",
      "Don't micromanage the process — keep them in the loop at key moments",
    ],
  },
  I: {
    type: "I",
    label: "Influential",
    communication: [
      "Be warm and enthusiastic",
      "Share stories and testimonials",
      "Let them talk — they process out loud",
      "Follow up with fun, visual materials",
      "Celebrate milestones together",
    ],
    homeStyle: [
      "Great entertaining spaces (open kitchen, patio)",
      "Open floor plans with lots of light",
      "Walkable neighborhoods with social venues",
      "Pool, outdoor kitchen, fire pit",
    ],
    giftIdeas: [
      "Social experience (restaurant gift card, wine tasting)",
      "Personalized housewarming party",
      "Fun decor or conversation-starter piece",
    ],
    avoid: [
      "Don't overwhelm with data and spreadsheets",
      "Don't be cold or overly formal",
      "Don't skip the relationship-building",
    ],
  },
  S: {
    type: "S",
    label: "Steady",
    communication: [
      "Be patient and unhurried",
      "Provide security and reassurance",
      "Walk through each step of the process",
      "Check in regularly without pressure",
      "Emphasize family and community",
    ],
    homeStyle: [
      "Family-friendly neighborhoods",
      "Good schools, low crime",
      "Established communities (not brand new)",
      "Functional, comfortable, cozy spaces",
    ],
    giftIdeas: [
      "Family-oriented gift (family photo session)",
      "Comfort items (nice blanket, kitchen set)",
      "Donation in their name to a local charity",
    ],
    avoid: [
      "Don't rush the decision or create urgency pressure",
      "Don't change plans without explanation",
      "Don't ignore their concerns or feelings",
    ],
  },
  C: {
    type: "C",
    label: "Conscientious",
    communication: [
      "Provide detailed written documentation",
      "Come prepared with data and comps",
      "Give them time to analyze before deciding",
      "Be accurate — they will check your facts",
      "Explain the 'why' behind recommendations",
    ],
    homeStyle: [
      "Well-maintained, updated systems (HVAC, roof, plumbing)",
      "Logical floor plans with good storage",
      "Quality construction and materials",
      "Energy-efficient features",
    ],
    giftIdeas: [
      "Quality reference book (home maintenance, local guide)",
      "Organizational items (label maker, home binder)",
      "Smart home device or quality tool set",
    ],
    avoid: [
      "Don't make unsubstantiated claims",
      "Don't rush them or use emotional pressure",
      "Don't skip inspection details or gloss over issues",
    ],
  },
};

export function getDISCPlaybook(type: string): DISCPlaybook | null {
  return PLAYBOOKS[type.toUpperCase()] || null;
}
