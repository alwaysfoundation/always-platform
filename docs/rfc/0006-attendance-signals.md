# RFC 0006: Counting who comes, in Always Reports

- Status: proposed
- Builds on: RFC 0001 (network reporting), ADR 0012 (journeys)

## Summary

Give churches a weekly, low-effort attendance figure, and give networks a national picture between the big surveys. Always Reports combines a few signals a church chooses (a headcount, check-ins, giving counts, a door counter or a wireless sensor) into one weekly estimate with a confidence range. It counts people. It never tracks a person.

## Why

- National attendance figures come from periodic surveys of a sample of churches, projected to the whole. They are valuable but slow, and they don't tell a local church how this term is going.
- Most churches already hold some signal: an usher's headcount, children's check-ins, weekly giving. It sits in different tools and is rarely compared.
- Volunteers won't fill in another form every week. Signals should arrive on their own wherever possible.

## The rule

**Count people, never track a person.** Every signal becomes a total per service before it leaves the building or the tool it lives in. No signal is ever linked to a response, a journey, a giver or a device across weeks. This is what keeps attendance data out of the personal-data tables altogether.

## Signals

| Signal | What it measures | Effort | Accuracy | Privacy | Decision |
| --- | --- | --- | --- | --- | --- |
| Headcount | People in the room, counted by an usher or in Planning Center Headcounts | A minute a service | High, the reference | None | Core |
| Check-ins | Children and volunteers checked in, from the church's management system | None once connected | High for those groups only | Totals only are imported | Core |
| Giving counts | Number of gifts and distinct givers each week, from the giving platform | None once connected | A trend, not a count | Counts only: no names, no amounts per person | Core, trend only |
| Door counter | People through the doors, from an optical or thermal sensor that keeps no images | Install once | High with calibration | None if no images are kept | Optional |
| Wireless sensor | Phones nearby, estimated from Wi-Fi and Bluetooth signals | Install once | Medium, needs calibration | Device identifiers never leave the sensor | Pilot only |
| Map busyness | Popular-times data from Google Maps | — | — | — | Ruled out |

### Wireless sensing, done safely

Phones broadcast Wi-Fi probe requests and Bluetooth advertisements. Since 2014, iOS, Android and Linux have randomised the hardware address in these, so a raw count of addresses over-counts and drifts. Newer estimators count from the rate of signals instead of unique addresses, and must be calibrated against headcounts.

A device address can be personal information under the Privacy Act. So the sensor:

- runs open-source firmware on a small device in the building;
- hashes each address with a salt that changes every service and is never stored, and keeps hashes only in memory for the service window;
- sends Always only counts per five-minute interval, never an address or a hash;
- cannot be set to recognise a device from one week to the next. Returning-visitor counts are deliberately out of reach;
- is never placed in children's rooms, and the church shows a sign saying it counts phones and stores no identifiers.

### Giving counts

Giving platforms such as Tithe.ly, Planning Center Giving and Pushpay can report weekly totals. We import the number of gifts and the number of distinct givers per week, nothing else. No names, no amounts per person, and never joined to attendance or journeys per person. Tithe.ly grants API access on request; Planning Center's Check-Ins and Giving APIs are read-only, which is all we need.

### Ruled out: Google Maps busyness

Google calculates popular times from people who opted in to location history, and doesn't offer it through the Places API. The libraries that read it go through undocumented interfaces against Google's terms. We won't scrape it. If Google offers it through an API, we can reconsider.

## How the estimate works

1/ The headcount is the reference. A church that records even an occasional headcount calibrates every other signal it has.

2/ Each other signal gets a per-church ratio to the headcount, updated as new headcounts arrive (for example, people per distinct giver, or people per device-signal rate).

3/ The weekly estimate is the weighted combination, shown with a range. With no recent headcount, the range widens, and the church is prompted to count once.

4/ Network totals sum church estimates by region and week, withholding any region with fewer than three churches reporting. Churches choose whether their figures count towards network totals.

## Data and API

Attendance is a fact about a church's service, not about people, so it sits outside the personal-data tables. It is still scoped to the church by row-level security.

- `attendance_observation(org_id, service_at, source, count, interval, created_at)` with `source` one of `headcount`, `checkins`, `giving_gifts`, `giving_givers`, `door`, `wireless`.
- `POST /v1/attendance` with a new scope, `attendance:write`, from a person, a connector or a registered sensor.
- `GET /v1/attendance/estimate?from&to` for the church: weekly estimate, range, and which signals contributed.
- `GET /v1/network/attendance?region&from&to` for networks: totals and trends, small regions withheld.
- Connectors: Planning Center Headcounts and Check-Ins, Tithe.ly, Planning Center Giving, Elvanto. Each imports totals only.
- Sensors register with a per-device key, can only post counts for their church, and can be revoked.

## Pilot

Six months with about ten churches of different sizes and settings. Each records headcounts every week, plus one or two other signals. We publish:

- the error of each signal against the headcount, by church size;
- how many volunteer minutes each signal saves;
- what churches found useful, and what they stopped using.

## Relationship to national surveys

This complements national surveys rather than replacing them. With churches' agreement, network totals can be shared with researchers such as NCLS Research, and survey findings can help calibrate the national picture.

## Open questions

- Does Prolegis agree that salted, in-memory device hashes that never leave the sensor keep us outside "collection" of personal information? We will do a privacy impact assessment before any wireless sensor runs.
- Which door counters meet "no images kept" and are affordable for a small church?
- Should online attendance (live-stream viewers) be a separate signal or left out?
- How do multi-site churches report: per site, per service, or both?

## Needs

- Prolegis review and a privacy impact assessment for wireless sensing.
- API access from Tithe.ly, and Planning Center OAuth for connectors.
- A small hardware budget for pilot sensors and counters.
