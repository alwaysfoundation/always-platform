/**
 * Checks a message before any model sees it. Personal crises and young people are out of scope for
 * Always AI, so these get a fixed, kind reply and the model is never asked. Deliberately simple and
 * cautious: it errs towards pointing people to a person.
 */
const CRISIS = /\b(suicid\w*|kill (myself|me)|end (my|it all)|self[- ]?harm|cut(ting)? myself|want to die|hurt (myself|someone)|being abused|abus(e|ing) me|overdose|no reason to live)\b/i;
const YOUNG = /\b(i'?m|i am) (1[0-7]|[5-9]) ?(years old|yo|y\/o)?\b|\b(i'?m|i am) in (year|grade) ([1-9]|1[0-2])\b/i;

export type Guard = { stop: true; reply: string } | { stop: false };

export function guard(text: string): Guard {
  if (CRISIS.test(text)) return { stop: true, reply: 'Always AI is a study tool and can’t help with this. Please talk now with someone you trust, your pastor or a qualified professional. If you or anyone else may be in danger, contact your local emergency services straight away.' };
  if (YOUNG.test(text)) return { stop: true, reply: 'Always AI is for adults. Please talk with a parent, your youth leader or your pastor.' };
  return { stop: false };
}
