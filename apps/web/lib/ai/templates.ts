/** Starting points. Words in [brackets] are for the person to fill in before sending. */
export const TEMPLATES = [
  { group: 'Prepare', title: 'Plan a sermon series', prompt: 'Plan a [6]-week sermon series on [Philippians]. For each week give the passage, the main idea in one sentence, and one way to apply it.' },
  { group: 'Prepare', title: 'Explain a passage', prompt: 'Explain [Philippians 2:5-11]: its context, its main idea, and what it teaches about Jesus.' },
  { group: 'Prepare', title: 'Small group questions', prompt: 'Write [five] discussion questions for a small group on [Romans 12:1-2], moving from understanding the text to living it out.' },
  { group: 'Prepare', title: 'Illustrations', prompt: 'Suggest three everyday illustrations for the idea of [grace] in [Ephesians 2:8-9], suitable for [a mixed congregation].' },
  { group: 'Welcome', title: 'Response page wording', prompt: 'Write warm, simple wording for our response page after [an Easter service], with three next steps people can choose. Plain words, no church jargon.' },
  { group: 'Welcome', title: 'Welcome message template', prompt: 'Write a short, warm text message our team can send to someone who asked to [find a church]. Use [first name] as a placeholder. No pressure, and offer one simple next step.' },
  { group: 'Lead', title: 'Board report summary', prompt: 'Turn these totals into a short, encouraging summary for our board, in plain words: [responded 42, introduced 38, contacted 31, connected 19 this quarter].' },
  { group: 'Lead', title: 'Explain a safety rule', prompt: 'Explain in plain English what [a Working With Children Check] is, who in a church needs one, and what we should keep on record.' },
] as const;
