/** Example reports with made-up figures, so ministries and funders can see what Always reporting looks like. */
import type { Report } from './report';

const defs = {
  responded: 'People who responded and agreed to be introduced to a next step.',
  introduced: 'People introduced to a verified church or ministry near them.',
  accepted: 'Introductions a church or ministry accepted, so they could reach out.',
  contacted: 'People a church or ministry logged getting in touch with.',
  connected: 'People who told us themselves that they are connected.',
  care_team: 'People the care team helped because no church nearby could yet.',
};
const privacy = 'Totals only. Figures under 10 people (20 where young people are included) are withheld so no one can be identified.';
const months = (rows: [string, number, number, number, number, number, number][]) =>
  rows.map(([month, responded, introduced, accepted, contacted, connected, care_team]) => ({ month, responded, introduced, accepted, contacted, connected, care_team }));

export const EXAMPLES: { slug: string; name: string; who: string; report: Report }[] = [
  {
    slug: 'worship-tour', name: 'A worship tour', who: 'Concerts across five cities, with a response moment each night.',
    report: {
      example: true, organisation: 'Example Worship Tour', view: 'sender',
      profile: { title: 'Australian tour follow-up', funder_name: 'Prepared for the tour partners', intro: 'Every night people responded to Jesus. Here is what happened next, city by city and month by month.' },
      period: { from: '2026-08-01', to: '2026-10-31' },
      totals: { responded: 1240, introduced: 1188, accepted: 1046, contacted: 962, connected: 418, care_team: 52 },
      byMonth: months([['2026-08', 410, 392, 340, 311, 120, 18], ['2026-09', 520, 501, 448, 412, 181, 21], ['2026-10', 310, 295, 258, 239, 117, 13]]),
      byStep: [{ step: 'church', count: 702 }, { step: 'explore', count: 318 }, { step: 'talk', count: 141 }, { step: 'read', count: 79 }],
      byRegion: [{ region: 'NSW', count: 412 }, { region: 'VIC', count: 356 }, { region: 'QLD', count: 248 }, { region: 'SA', count: 131 }, { region: 'WA', count: 93 }],
      youngPeople: 214, definitions: defs, privacy,
      stories: [{ quote: 'I didn’t know anyone at church. Someone texted me the next week and met me at the door.', by: 'Jess, Brisbane · shared with consent (example)' }],
    },
  },
  {
    slug: 'youth-camp', name: 'A youth camp', who: 'A summer camp for high schoolers, with parents confirming for under 15s.',
    report: {
      example: true, organisation: 'Example Youth Camp', view: 'sender',
      profile: { title: 'Summer camp: next steps', funder_name: 'Prepared for our board and church partners', intro: 'Young people who said yes at camp were introduced to verified youth groups near home. Under 15s were introduced only after a parent confirmed.' },
      period: { from: '2027-01-01', to: '2027-01-31' },
      totals: { responded: 186, introduced: 171, accepted: 158, contacted: 149, connected: 92, care_team: null },
      byMonth: months([['2027-01', 186, 171, 158, 149, 92, 0]]),
      byStep: [{ step: 'youth', count: 131 }, { step: 'church', count: 41 }, { step: 'talk', count: null }],
      byRegion: [{ region: 'NSW', count: 118 }, { region: 'ACT', count: 37 }, { region: 'QLD', count: null }],
      youngPeople: 186, definitions: defs, privacy,
    },
  },
  {
    slug: 'online-testimony', name: 'An online testimony series', who: 'Short videos of Australians sharing their story, with a response link in each.',
    report: {
      example: true, organisation: 'Example Media Ministry', view: 'sender',
      profile: { title: 'Stories of hope: online responses', funder_name: 'Prepared for the Example Foundation', intro: 'People responded on their own phones after watching. An invisible check filtered out spam, and each person chose their next step.' },
      period: { from: '2026-07-01', to: '2026-12-31' },
      totals: { responded: 604, introduced: 571, accepted: 489, contacted: 431, connected: 162, care_team: 47 },
      byMonth: months([['2026-07', 61, 58, 49, 44, 15, 5], ['2026-08', 84, 80, 69, 61, 22, 7], ['2026-09', 97, 92, 80, 70, 27, 8], ['2026-10', 118, 111, 95, 84, 33, 9], ['2026-11', 126, 119, 101, 89, 35, 9], ['2026-12', 118, 111, 95, 83, 30, 9]]),
      byStep: [{ step: 'explore', count: 248 }, { step: 'talk', count: 157 }, { step: 'church', count: 139 }, { step: 'read', count: 60 }],
      byRegion: [{ region: 'NSW', count: 201 }, { region: 'VIC', count: 166 }, { region: 'QLD', count: 112 }, { region: 'WA', count: 58 }, { region: 'SA', count: 41 }, { region: 'TAS', count: 14 }, { region: 'ACT', count: 12 }],
      youngPeople: 38, definitions: defs, privacy,
    },
  },
  {
    slug: 'street-team', name: 'A street evangelism team', who: 'Evangelists using the Always app and printed cards in city centres.',
    report: {
      example: true, organisation: 'Example Street Team', view: 'sender',
      profile: { title: 'Monthly team report', funder_name: 'Prepared for our supporters', intro: 'Our team shared the gospel on the streets every week. When someone wanted a next step, we introduced them to a church near where they live.' },
      period: { from: '2026-10-01', to: '2026-10-31' },
      totals: { responded: 64, introduced: 61, accepted: 52, contacted: 47, connected: 19, care_team: null },
      byMonth: months([['2026-10', 64, 61, 52, 47, 19, 0]]),
      byStep: [{ step: 'church', count: 29 }, { step: 'talk', count: 21 }, { step: 'explore', count: 14 }],
      byRegion: [{ region: 'NSW', count: 41 }, { region: 'VIC', count: 23 }],
      youngPeople: null, definitions: defs, privacy,
    },
  },
  {
    slug: 'local-church', name: 'A local church', who: 'A church that welcomes people introduced from events and online.',
    report: {
      example: true, organisation: 'Example Community Church', view: 'receiver',
      profile: { title: 'People we welcomed', funder_name: 'For our elders and denomination', intro: 'People who responded at events and online were introduced to us. This is how many we welcomed and walked with.' },
      period: { from: '2026-07-01', to: '2026-12-31' },
      totals: { accepted: 48, contacted: 45, connected: 27 },
      byMonth: [{ month: '2026-07', accepted: null, contacted: null, connected: null }, { month: '2026-08', accepted: 11, contacted: 10, connected: null }, { month: '2026-09', accepted: null, contacted: null, connected: null }, { month: '2026-10', accepted: 13, contacted: 12, connected: null }, { month: '2026-11', accepted: null, contacted: null, connected: null }, { month: '2026-12', accepted: 10, contacted: 10, connected: null }],
      byStep: [{ step: 'church', count: 31 }, { step: 'explore', count: 17 }],
      byRegion: [{ region: 'NSW', count: 48 }],
      youngPeople: null, definitions: { accepted: defs.accepted, contacted: defs.contacted, connected: defs.connected }, privacy,
    },
  },
  {
    slug: 'network', name: 'The whole network', who: 'What the foundation publishes each quarter, including the people we missed.',
    report: {
      example: true, organisation: 'Always Foundation', view: 'network',
      profile: { title: 'The Always Network, October to December', funder_name: 'Published for members and supporters', intro: 'Every figure counts each person once, however many ministries walked with them. It includes the people we couldn’t connect.' },
      period: { from: '2026-10-01', to: '2026-12-31' },
      totals: { responded: 4820, introduced: 4610, accepted: 4015, contacted: 3702, connected: 1544, care_team: 211 },
      byMonth: months([['2026-10', 1490, 1424, 1236, 1139, 471, 66], ['2026-11', 1712, 1638, 1428, 1318, 552, 74], ['2026-12', 1618, 1548, 1351, 1245, 521, 71]]),
      byStep: [{ step: 'church', count: 2410 }, { step: 'explore', count: 1206 }, { step: 'talk', count: 588 }, { step: 'youth', count: 402 }, { step: 'read', count: 214 }],
      byRegion: [{ region: 'NSW', count: 1612 }, { region: 'VIC', count: 1288 }, { region: 'QLD', count: 902 }, { region: 'WA', count: 431 }, { region: 'SA', count: 378 }, { region: 'TAS', count: 88 }, { region: 'ACT', count: 81 }, { region: 'NT', count: 40 }],
      youngPeople: 1102, definitions: defs, privacy,
    },
  },
];
