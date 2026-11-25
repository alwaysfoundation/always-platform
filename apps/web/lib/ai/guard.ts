import model from './guard-model.json';

/**
 * Checks a message before any model sees it. Personal crises, danger and young people are out of
 * scope for Always AI, so these get a fixed, kind reply and the model is never asked. Two layers:
 * hand-written rules, then a small on-device classifier (TF-IDF + logistic regression, trained on
 * synthetic text in the research repo) for phrasings the rules miss. It errs towards a person.
 */

const CRISIS = [
  /\b(kill|killing|hurt|hurting|harm|harming|cut|cutting)\s+(myself|me)\b/,
  /\bend(ing)?\s+(my life|it all|everything|things)\b/,
  /\bself[- ]?harm(ing)?\b/,
  /\b(want|wanna|going|ready|wish)\s+(to\s+)?(die|be dead|disappear( forever)?)\b/,
  /\bwish (i|i'?d) (was|were|had) (dead|never been born|not here)\b/,
  /\b(don'?t|do not|never) want to (live|be alive|wake up|be here)( anymore)?\b/,
  /\b(better off|happier) without me\b/,
  /\bno (reason|point) (to|in) (live|living|going on)\b/,
  /\b(suicidal|commit suicide|thinking (about|of) suicide|thoughts? of suicide|killing myself|kill myself)\b/,
  /\b(took|take|taking|swallowed) (too many|a lot of|all (my|the)) (pills|tablets|meds|medication)\b/,
  /\bhow many (pills|tablets) (would|does|will|to)\b/,
  /\b(i'?m going to|i will|i want to) (hurt|kill|harm) (someone|somebody|him|her|them|people)\b/,
  /\b(thinking about|going to) jump(ing)?\b/,
  /\bplanning to overdose\b|\b(i|i'?ve) overdosed\b/,
  /\b(i'?ve|i have) lost all hope\b|\bcan'?t (go on|do this anymore|cope anymore)\b/,
  /\b(killed|kill) myself\b|\bwish i'?d never been born\b/,
  /\bsuicid\w*\b.*\b(i'?m|i am) (thinking|considering)\b|\b(i'?m|i am) (thinking|considering)\b.*\bsuicid\w*/,
  /\b(hits|beats|hurts|chokes|touches|touched|touching|rapes?d?|abuses|abused|is abusing|has been abusing)\s+me\b/,
  /\b(i'?m|i am|i was|i've been|i have been|i keep getting|i get) (being )?(abused|molested|raped|assaulted|hit|beaten)\b/,
  /\b(scared|afraid|frightened) of my (partner|husband|wife|dad|father|mum|mom|mother|boyfriend|girlfriend|stepdad|stepfather)\b/,
  /\bnot safe at home\b/,
];

const YOUNG = [
  /\b(i'?m|i am|im)\s+(only\s+|just\s+)?([5-9]|1[0-7])(\s*(years? old|yrs?|yo|y\/o))?\b(?!\s*(years? (of|in)|weeks|months|%|people|kids|children|members|-|to))/,
  /\b(i'?m|i am|im)\s+in\s+(year|grade|yr)\s*([1-9]|1[0-2])\b/,
  /\bi'?m in (primary|middle|high) school\b/,
  /\b(i'?m|i am|im)\s+(only\s+|just\s+)?(five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)\b(?!\s*(years? (of|in)|weeks|months|people|kids|children|members))/,
];

const ADULT = /\b(i'?m|i am|im)\s+(1[89]|[2-9]\d|1[0-1]\d)\b(?!\s*(weeks|months|%))/;

type Vocab = Record<string, [number, number, number]>;
const WORD = model.word.vocab as unknown as Vocab;
const CHAR = model.char.vocab as unknown as Vocab;

// Python's \b\w[\w']*\b: a trailing apostrophe is not part of the token.
function words(text: string): string[] {
  const tokens = (text.match(/[\p{L}\p{N}_][\p{L}\p{N}_']*/gu) ?? []).map((t) => t.replace(/'+$/, ''));
  const grams = [...tokens];
  for (let i = 0; i + 1 < tokens.length; i++) grams.push(`${tokens[i]} ${tokens[i + 1]}`);
  return grams;
}

// scikit-learn's char_wb analyser, n = 3 and 4.
function chars(text: string): string[] {
  const grams: string[] = [];
  for (const raw of text.replace(/\s\s+/g, ' ').split(/\s+/).filter(Boolean)) {
    const w = ` ${raw} `;
    for (let n = 3; n <= 4; n++) {
      let offset = 0;
      grams.push(w.slice(0, n));
      while (offset + n < w.length) {
        offset++;
        grams.push(w.slice(offset, offset + n));
      }
      if (offset === 0) break;
    }
  }
  return grams;
}

function block(grams: string[], vocab: Vocab): number {
  const counts = new Map<string, number>();
  for (const g of grams) if (g in vocab) counts.set(g, (counts.get(g) ?? 0) + 1);
  let norm = 0;
  let dot = 0;
  for (const [g, c] of counts) {
    const [, idf, coef] = vocab[g];
    const v = (1 + Math.log(c)) * idf;
    norm += v * v;
    dot += v * coef;
  }
  return norm ? dot / Math.sqrt(norm) : 0;
}

export function score(text: string): number {
  const t = text.toLowerCase();
  const z = model.intercept + block(words(t), WORD) + block(chars(t), CHAR);
  return 1 / (1 + Math.exp(-z));
}

export type Guard = { stop: true; reply: string } | { stop: false };

const CARE = 'Always AI is a study tool and can’t help with this. Please talk now with someone you trust, your pastor or a qualified professional. If you or anyone else may be in danger, contact your local emergency services straight away.';
const ADULTS = 'Always AI is for adults. Please talk with a parent, your youth leader or your pastor.';

export function guard(text: string): Guard {
  const t = text.replace(/[‘’ʼ]/g, "'").toLowerCase();
  if (CRISIS.some((r) => r.test(t))) return { stop: true, reply: CARE };
  if (YOUNG.some((r) => r.test(t))) return { stop: true, reply: ADULTS };
  const p = score(t);
  if (p >= model.threshold && !(ADULT.test(t) && p < 0.8)) return { stop: true, reply: CARE };
  return { stop: false };
}
