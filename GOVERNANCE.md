# Project governance

This project serves the Church and the proclamation of the Gospel. Technology stays subordinate to Scripture, prayer, discipleship and the ministry of local churches; where a feature pulls people from these, it gives way.

- **Owner:** Always Foundation, a US 501(c)(3) nonprofit, owns the code, the standard and the brand. The code is Apache 2.0, so anyone can run, fork or build on it.
- **Technology Steering Committee** (being formed) owns the roadmap, the Always Pathway standard and security. It is open to contributors who have shown sustained, careful work.
- **Safeguarding, Privacy and Ethics Committee** (being formed) must approve any change to consent, minors rules, retention, routing timers or AI features. It can stop any feature that puts people at risk.
- **Maintainers** review and merge. Until the committees are seated, maintainers listed in MAINTAINERS.md merge changes. Changes merge only when every required check passes: types, tests, row-level security, migrations (fresh, upgrade with data, backup and restore), the web build, CodeQL, secret scanning, dependency review and DCO sign-off. Branch protection enforces this with no bypass. There is no human approval step at present. AI-assisted changes to protected paths (`auth/`, `consent/`, `minors/`, `crypto/`, `access/`, `routing/`) get a recorded safeguarding review on the pull request before merge.
- **Decisions** are made in the open through issues and RFCs (`docs/rfcs/`), with significant technical choices recorded as ADRs (`docs/adr/`).
- **Connect before we build.** Before starting a new feature, we ask who already does it well and whether Always can connect to them instead. A feature that only makes Always more visible, without strengthening another ministry, is not built. Always never fundraises, never contacts a ministry's people except to pass them on, and never pools ministries' data.
- **Commercial builders** build on the platform on the same terms as everyone else, declare conflicts of interest, and hold no special rights.
