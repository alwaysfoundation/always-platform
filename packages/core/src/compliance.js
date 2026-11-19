/**
 * Always Safety: the assessment engine.
 *
 * Pure functions, no I/O. Given the open obligations register, a ministry's profile,
 * its answers and what Always Platform already guarantees, produce an assessment:
 * which obligations apply, which are met, what needs attention, and what is coming.
 *
 * The engine never decides what the law says. It only applies obligations a qualified
 * person has approved into the register (RFC 0003). It is not legal advice.
 */
export const JURISDICTIONS = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
/** Evaluate a condition against a profile. Unknown shapes fail closed (false). */
export function holds(c, p) {
    if (!c)
        return true;
    if ('all' in c)
        return c.all.every((x) => holds(x, p));
    if ('any' in c)
        return c.any.some((x) => holds(x, p));
    if ('not' in c)
        return !holds(c.not, p);
    if ('includesAny' in c)
        return c.field === 'states' && c.includesAny.some((s) => p.states.includes(s));
    if ('is' in c)
        return p[c.field] === c.is;
    return false;
}
/** Whether the obligation is a legal requirement for this ministry, or good practice. */
export function strengthOf(o, p) {
    if (o.recommendedOnly)
        return 'recommended';
    return holds(o.requiredWhen, p) ? 'required' : 'recommended';
}
function evidenceStatus(e, answers, signals) {
    if (e.kind === 'platform')
        return e.check && signals[e.check] ? 'ok' : answer(answers[e.id]);
    return answer(answers[e.id]);
}
function answer(a) {
    if (a === 'yes' || a === 'not_applicable')
        return 'ok';
    if (a === 'no')
        return 'missing';
    return 'unanswered';
}
const ORDER = { attention: 0, check: 1, upcoming: 2, met: 3 };
/** The assessment for one ministry, as of a date. Deterministic: same inputs, same output. */
export function assess(register, profile, answers, signals, asOf) {
    const items = [];
    const watching = [];
    for (const o of register.obligations) {
        if (!holds(o.appliesWhen, profile))
            continue;
        if (o.status === 'watch') {
            watching.push({ obligationId: o.id, title: o.title, summary: o.summary });
            continue;
        }
        const relevant = o.evidence.filter((e) => holds(e.onlyWhen, profile));
        const missing = [];
        const unanswered = [];
        for (const e of relevant) {
            const s = evidenceStatus(e, answers, signals);
            if (s === 'missing')
                missing.push(e.prompt);
            if (s === 'unanswered')
                unanswered.push(e.prompt);
        }
        const notYet = o.status === 'upcoming' && (!o.commences || new Date(`${o.commences}T00:00:00+10:00`) > asOf);
        const status = notYet ? 'upcoming' : missing.length ? 'attention' : unanswered.length ? 'check' : 'met';
        items.push({
            obligationId: o.id,
            area: o.area,
            title: o.title,
            summary: o.summary,
            strength: strengthOf(o, profile),
            status,
            missing,
            unanswered,
            law: lawFor(o, profile),
            guidance: o.guidance,
            commences: o.commences,
        });
    }
    items.sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.strength === b.strength ? 0 : a.strength === 'required' ? -1 : 1));
    const count = (s) => items.filter((i) => i.status === s).length;
    return {
        asOf: asOf.toISOString().slice(0, 10),
        registerVersion: register.version,
        registerStatus: register.status,
        items,
        watching,
        summary: { required: items.filter((i) => i.strength === 'required').length, met: count('met'), attention: count('attention'), check: count('check'), upcoming: count('upcoming') },
        notice: register.notice,
    };
}
/** For state-by-state obligations, show only the laws for the states the ministry works in. */
function lawFor(o, p) {
    if (o.jurisdiction !== 'STATES')
        return o.law;
    const local = o.law.filter((l) => !l.jurisdiction || p.states.includes(l.jurisdiction));
    return local.length ? local : o.law;
}
/** What changed between two register versions: the "what changed this quarter" feed. */
/** JSON with sorted keys, so a stored copy (jsonb reorders keys) compares equal to the original. */
function stable(v) {
    if (Array.isArray(v))
        return `[${v.map(stable).join(',')}]`;
    if (v && typeof v === 'object')
        return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
    return JSON.stringify(v) ?? 'null';
}
export function diffRegisters(before, after) {
    const old = new Map(before.obligations.map((o) => [o.id, o]));
    const now = new Map(after.obligations.map((o) => [o.id, o]));
    const out = [];
    for (const o of after.obligations) {
        const prev = old.get(o.id);
        if (!prev) {
            out.push({ obligationId: o.id, title: o.title, change: 'added', what: [] });
            continue;
        }
        const what = [];
        if (prev.status !== o.status)
            what.push(`status: ${prev.status} to ${o.status}`);
        if (prev.commences !== o.commences)
            what.push('start date');
        if (stable(prev.appliesWhen) !== stable(o.appliesWhen) || stable(prev.requiredWhen) !== stable(o.requiredWhen))
            what.push('who it applies to');
        if (stable(prev.evidence) !== stable(o.evidence))
            what.push('what to show');
        if (prev.summary !== o.summary || prev.title !== o.title)
            what.push('wording');
        if (stable(prev.law) !== stable(o.law))
            what.push('legal source');
        if (what.length)
            out.push({ obligationId: o.id, title: o.title, change: 'changed', what });
    }
    for (const o of before.obligations)
        if (!now.has(o.id))
            out.push({ obligationId: o.id, title: o.title, change: 'removed', what: [] });
    return out;
}
/** Calendar quarter in Sydney time, for example "2026-Q4". */
export function quarterOf(d) {
    const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: 'numeric' }).formatToParts(d);
    const year = Number(parts.find((x) => x.type === 'year').value);
    const month = Number(parts.find((x) => x.type === 'month').value);
    return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}
/** Problems with a register that would make assessments unreliable. Empty means usable. */
export function validateRegister(r) {
    const problems = [];
    const ids = new Set();
    const evidenceIds = new Set();
    for (const o of r.obligations) {
        if (ids.has(o.id))
            problems.push(`duplicate obligation ${o.id}`);
        ids.add(o.id);
        if (!o.law.length)
            problems.push(`${o.id}: no legal source`);
        for (const l of o.law)
            if (!/^https:\/\//.test(l.url))
                problems.push(`${o.id}: source must be https`);
        if (o.status === 'upcoming' && !o.commences)
            problems.push(`${o.id}: upcoming without a start date`);
        for (const e of o.evidence) {
            if (evidenceIds.has(e.id))
                problems.push(`duplicate evidence ${e.id}`);
            evidenceIds.add(e.id);
            if (e.kind === 'platform' && !e.check)
                problems.push(`${e.id}: platform evidence needs a check`);
        }
    }
    return problems;
}
