# Changelog

## [3.0.0](https://github.com/alwaysfoundation/always-platform/compare/v2.0.0...v3.0.0) (2026-11-25)


### ⚠ BREAKING CHANGES

* **safety:** the bundled register moved to spec/safety/register.json.

### Features

* **account:** affirm the Nicene Creed when creating an organisation ([#56](https://github.com/alwaysfoundation/always-platform/issues/56)) ([459153f](https://github.com/alwaysfoundation/always-platform/commit/459153f5e47c393bfc36a3a4e146db4296594857))
* **account:** Always AI is the `ai` module of the Always account (ADR 0021) ([#72](https://github.com/alwaysfoundation/always-platform/issues/72)) ([f91a399](https://github.com/alwaysfoundation/always-platform/commit/f91a399fa435e65220c768d06839135cb37981c7))
* **account:** one Always account, modules switched on (ADR 0019) ([#54](https://github.com/alwaysfoundation/always-platform/issues/54)) ([f95bfcc](https://github.com/alwaysfoundation/always-platform/commit/f95bfcc1edcf2e44db38ab52c67e4cd648c8bb14))
* **account:** state optional for organisations outside Australia ([#63](https://github.com/alwaysfoundation/always-platform/issues/63)) ([4b301a7](https://github.com/alwaysfoundation/always-platform/commit/4b301a7b4ad72bde2678e342216715b6496778f1))
* **account:** team invites and saved brand ([#62](https://github.com/alwaysfoundation/always-platform/issues/62)) ([55cc7b5](https://github.com/alwaysfoundation/always-platform/commit/55cc7b58c92751d5628765bcc561b457c6798516))
* **ai:** Always AI 0.1 and ADR 0018 ([#53](https://github.com/alwaysfoundation/always-platform/issues/53)) ([07c7093](https://github.com/alwaysfoundation/always-platform/commit/07c70935dd2b2cb832d0c372aede959fc0a9926d))
* **ai:** Always AI 0.1, faithful AI infrastructure; ADR 0018 infrastructure first and never a companion ([#55](https://github.com/alwaysfoundation/always-platform/issues/55)) ([4f50d2c](https://github.com/alwaysfoundation/always-platform/commit/4f50d2cde2635cc0a37fb063a73ae6a92349e8e7))
* **api:** /health says whether sign-in is open ([#67](https://github.com/alwaysfoundation/always-platform/issues/67)) ([e7d6f4e](https://github.com/alwaysfoundation/always-platform/commit/e7d6f4e0dc829dd26269c3b2461a03e66b5f74a8))
* **api:** send email through Resend when RESEND_API_KEY is set (ADR 0020) ([#69](https://github.com/alwaysfoundation/always-platform/issues/69)) ([b58b618](https://github.com/alwaysfoundation/always-platform/commit/b58b618db8a44210176304042a79c0691d306f52))
* **api:** website calls account routes directly, foundation origins only ([#66](https://github.com/alwaysfoundation/always-platform/issues/66)) ([70db1c9](https://github.com/alwaysfoundation/always-platform/commit/70db1c9947c814cad955b1a03315e8df65d0726a))
* foundation measures, totals only with small counts withheld ([#85](https://github.com/alwaysfoundation/always-platform/issues/85)) ([8d77a7e](https://github.com/alwaysfoundation/always-platform/commit/8d77a7ec29323145d874ca2d66ad4f4b5310d01d))
* Reports built into every account; Always Safety covers safe follow-up (ADR 0023) ([#92](https://github.com/alwaysfoundation/always-platform/issues/92)) ([c4d21d9](https://github.com/alwaysfoundation/always-platform/commit/c4d21d9c44a47d387e54179d830e5058e5b70397))
* response pages for every new account, setup emails, demo hand-off ([#84](https://github.com/alwaysfoundation/always-platform/issues/84)) ([e684620](https://github.com/alwaysfoundation/always-platform/commit/e684620e8b73f8ce9f42637407e3be7c8dad763e))
* retire the Always AI module (ADR 0022) ([#90](https://github.com/alwaysfoundation/always-platform/issues/90)) ([773cdad](https://github.com/alwaysfoundation/always-platform/commit/773cdad7011571904a97d845be4e8f23addd14cc))
* **safety:** Always Safety for six regions, safety names everywhere, MCP tools ([#44](https://github.com/alwaysfoundation/always-platform/issues/44)) ([2724890](https://github.com/alwaysfoundation/always-platform/commit/2724890d42ae6f72bfc78c5f10d9a499e31701aa))
* **spec:** Handoff standard v0.2 for any country ([#46](https://github.com/alwaysfoundation/always-platform/issues/46)) ([bab3f3d](https://github.com/alwaysfoundation/always-platform/commit/bab3f3d1887f2719e03f30f157142cf5504adf2b))
* **web:** a calmer app: Today home, Settings, light sidebar and phone tabs ([#77](https://github.com/alwaysfoundation/always-platform/issues/77)) ([90a99ad](https://github.com/alwaysfoundation/always-platform/commit/90a99adcf12c7a91d2750759a2941fc6feb84c1c))
* **web:** Always AI chat in the browser, a demo account, and a static build ([#75](https://github.com/alwaysfoundation/always-platform/issues/75)) ([157efb2](https://github.com/alwaysfoundation/always-platform/commit/157efb22b26c0db86b585f559522922399809c0f))
* **web:** Always AI in the Always home; the app lives at my.alwaysfoundation.org ([#74](https://github.com/alwaysfoundation/always-platform/issues/74)) ([a3df917](https://github.com/alwaysfoundation/always-platform/commit/a3df917517b688436591b8bafd495d1682275397))
* **web:** calmer inbox with pass reasons inline, tidy reports toolbar, consistent page heads ([#81](https://github.com/alwaysfoundation/always-platform/issues/81)) ([2a84314](https://github.com/alwaysfoundation/always-platform/commit/2a843147db0746ab7c671f5d5be3919c38dbb29e))
* **web:** dark mode, quieter surfaces and one list style for the inbox ([#82](https://github.com/alwaysfoundation/always-platform/issues/82)) ([0e9b405](https://github.com/alwaysfoundation/always-platform/commit/0e9b405b7f6893175c546af6e325959d647bc9f1))
* **web:** Scripture mode for devices without a model; calm empty states on Home ([#83](https://github.com/alwaysfoundation/always-platform/issues/83)) ([6e1dd80](https://github.com/alwaysfoundation/always-platform/commit/6e1dd809dd5c41636fc1fa8659b0b3350297edee))
* **web:** start an account, sign in by email code, and the Always home ([#71](https://github.com/alwaysfoundation/always-platform/issues/71)) ([a344b50](https://github.com/alwaysfoundation/always-platform/commit/a344b507d7770a8ad28c5c232b2596ea781b50b3))
* **web:** until accounts open, the last step of starting offers the demo ([#76](https://github.com/alwaysfoundation/always-platform/issues/76)) ([898294c](https://github.com/alwaysfoundation/always-platform/commit/898294c8e05b35b07a8edb0226a4d7373ab3a2ba))


### Bug Fixes

* **account:** invite links open Your Always home ([#64](https://github.com/alwaysfoundation/always-platform/issues/64)) ([83686d4](https://github.com/alwaysfoundation/always-platform/commit/83686d4312bcb1f65daf27eb4c2758659b4ef501))
* **ai:** catch more crisis and under-18 messages before the model runs ([#78](https://github.com/alwaysfoundation/always-platform/issues/78)) ([d5e4cdf](https://github.com/alwaysfoundation/always-platform/commit/d5e4cdff73b72df2a7772f2e98d513f83f468423))
* **ai:** Creed text and historic errors checked against sources ([#60](https://github.com/alwaysfoundation/always-platform/issues/60)) ([1bc2edc](https://github.com/alwaysfoundation/always-platform/commit/1bc2edcb47f3b2bb1cbf6a27141966d2c6ba368b))
* sync the lock file with the packages/ai workspace; Railway installs dev tools ([#68](https://github.com/alwaysfoundation/always-platform/issues/68)) ([f9aa36c](https://github.com/alwaysfoundation/always-platform/commit/f9aa36ce4246c8cc001b5d0866c5135f00fcdf96))
* **web:** demo account no longer lists the retired ai module ([#91](https://github.com/alwaysfoundation/always-platform/issues/91)) ([69396b7](https://github.com/alwaysfoundation/always-platform/commit/69396b73e81f70fa965da6aee38481e25b19ee2a))
* **web:** show the totals a church actually has on Home; global child safety check wording ([#80](https://github.com/alwaysfoundation/always-platform/issues/80)) ([8a7b29d](https://github.com/alwaysfoundation/always-platform/commit/8a7b29d9de13a379dc5bfe54724d71ee17099217))

## [2.0.0](https://github.com/alwaysfoundation/always-platform/compare/v1.0.0...v2.0.0) (2026-11-24)


### ⚠ BREAKING CHANGES

* share.journey is rejected; GET /v1/network/journeys is now GET /v1/network/totals; journey and milestone endpoints are removed.

### Features

* call the compliance product Always Safety ([#34](https://github.com/alwaysfoundation/always-platform/issues/34)) ([4a34ab4](https://github.com/alwaysfoundation/always-platform/commit/4a34ab4243b49ea735915b0e90bee8b9e622cde2))
* **claims:** approve claims confirmed from the church's own email domain ([#43](https://github.com/alwaysfoundation/always-platform/issues/43)) ([cb57d46](https://github.com/alwaysfoundation/always-platform/commit/cb57d46e2015d7c487b1b9a98b8ab2d8d23942b1))
* journeys across ministries, with consent ([#36](https://github.com/alwaysfoundation/always-platform/issues/36)) ([5a8247c](https://github.com/alwaysfoundation/always-platform/commit/5a8247cd9941a2cc00350b62f05dc61389961379))


### Bug Fixes

* **ci:** add the integrations workspace to the lock file ([#38](https://github.com/alwaysfoundation/always-platform/issues/38)) ([33d6466](https://github.com/alwaysfoundation/always-platform/commit/33d646659df8e293709e62abdb8210c08b18030f))


### Miscellaneous Chores

* remove journeys across ministries (record linkage) ([#41](https://github.com/alwaysfoundation/always-platform/issues/41)) ([0679614](https://github.com/alwaysfoundation/always-platform/commit/0679614bdecc4514c11184b8ec6792e4327fdce5))

## 1.0.0 (2026-11-19)


### Features

* Always API, SDK, scheduler, directory import, CI/CD and open-source governance ([2b49fbd](https://github.com/alwaysfoundation/always-platform/commit/2b49fbd1ff0b9fc0fe84aead89bf32bfa5f66525))
* **api:** let hosted response pages run on foundation subdomains ([415d77e](https://github.com/alwaysfoundation/always-platform/commit/415d77eaec1f20805f96c2f56eaf7a46b69e9ae4))
* **api:** let hosted response pages run on foundation subdomains ([f1dbfeb](https://github.com/alwaysfoundation/always-platform/commit/f1dbfebdd883956591190289aad59b9b3f628dc7))
* **api:** ministry sign-in and onboarding for Always Compliance ([0d3f25d](https://github.com/alwaysfoundation/always-platform/commit/0d3f25d1b1ab48840e03b7e8146b6e4f97711419))
* **api:** ministry sign-in and onboarding for Always Compliance ([f504533](https://github.com/alwaysfoundation/always-platform/commit/f50453346201728f95ff86553ef41e6102961937))
* Christian events and hosted response pages for online responses ([50b929b](https://github.com/alwaysfoundation/always-platform/commit/50b929bccbc94a49203c9a885f90df06e24569bb))
* **compliance:** Always Compliance register, engine, API and jobs (RFC 0003) ([a4689a0](https://github.com/alwaysfoundation/always-platform/commit/a4689a0f71edc743dfd25d58bfdf414d3262c259))
* **compliance:** Always Compliance register, engine, API and jobs (RFC 0003) ([ce2e0f8](https://github.com/alwaysfoundation/always-platform/commit/ce2e0f8108806bf4b9cc91599f08d64c601e972c))
* **compliance:** compliance infrastructure (RFC 0004) ([a4d1c8b](https://github.com/alwaysfoundation/always-platform/commit/a4d1c8be8e124b82cb2016b3d42d25c201552ba8))
* **compliance:** compliance infrastructure (RFC 0004) ([42bc625](https://github.com/alwaysfoundation/always-platform/commit/42bc625f0dcc7a7c60984702b62bdf44f3490f6f))
* **consent:** child assent for under-15s and 12-month consent ([83fbfed](https://github.com/alwaysfoundation/always-platform/commit/83fbfeddf3e2050cdb49aa1d497d86f6e95bbc78))
* **consent:** child assent for under-15s and 12-month consent ([0e2ef54](https://github.com/alwaysfoundation/always-platform/commit/0e2ef5443831f9eaba4f2777c432e7348ee6f258))
* core rules engine, schema with RLS, handoff standard v0.1 and API contract ([042491f](https://github.com/alwaysfoundation/always-platform/commit/042491f29c2853d2461e28ad3fda6556c63c3748))
* **email:** send through Amazon SES in Sydney ([b3e39d0](https://github.com/alwaysfoundation/always-platform/commit/b3e39d08e4751175216cbf2a777871451ef2ba1d))
* **email:** send through Amazon SES in Sydney ([1e7b25d](https://github.com/alwaysfoundation/always-platform/commit/1e7b25d1a89c339dd2080ff6811008c284760e77))
* **email:** send through Resend; drop timing promises from docs ([bd53329](https://github.com/alwaysfoundation/always-platform/commit/bd533298c842bd117b39ed44dbc42b644f286a65))
* **evangelist:** Evangelist API, Scripture with an evangelism layer ([ed1a69f](https://github.com/alwaysfoundation/always-platform/commit/ed1a69f725fa1091a61d633228bdcfb0ebd2a551))
* **evangelist:** Evangelist API, Scripture with an evangelism layer ([18fa350](https://github.com/alwaysfoundation/always-platform/commit/18fa35069df6c5c24b5273098ca5c25c3e07096b))
* **feed:** church feed, verification, MCP server and church finder ([6e2acee](https://github.com/alwaysfoundation/always-platform/commit/6e2acee2c0ee7da86cdf8786936738c59b2ef364))
* **feed:** church feed, verification, MCP server and church finder ([122c46e](https://github.com/alwaysfoundation/always-platform/commit/122c46ea5ed81359899ec661680eefb767383d83))
* **field:** consented contact store for outreach apps ([acd1c3a](https://github.com/alwaysfoundation/always-platform/commit/acd1c3a5a22831bdfa9340f4001725d4f2c37ef2))
* **field:** consented contact store for outreach apps ([938a2cf](https://github.com/alwaysfoundation/always-platform/commit/938a2cf75741fb6891691d5685705231ddce2b26))
* **field:** let people choose to be connected with Alpha ([566ef14](https://github.com/alwaysfoundation/always-platform/commit/566ef141b2971688bd5e60fbd505f9b547234a9a))
* **field:** team leader access to a ministry's own contacts ([e8c0f39](https://github.com/alwaysfoundation/always-platform/commit/e8c0f39452ad8c4e861f517f239490a4fcbf2ea5))
* **hosting:** Vercel API function in Sydney and Supabase scheduled jobs ([64954c8](https://github.com/alwaysfoundation/always-platform/commit/64954c8bd3a9e36c941fedd11437ef42552f6acf))
* **hosting:** Vercel API function in Sydney and Supabase scheduled jobs ([c52a1cb](https://github.com/alwaysfoundation/always-platform/commit/c52a1cb5a55a043a835f622bc0516ad2443ee4fc))
* **integrations:** church management system connectors behind the consent gate ([a5fb04b](https://github.com/alwaysfoundation/always-platform/commit/a5fb04b283c24f2407c1a3e6e4e0cc357e30b5d5))
* **integrations:** church management system connectors behind the consent gate ([337cd03](https://github.com/alwaysfoundation/always-platform/commit/337cd034e7c6689cbe348465c11a7cfbb84de94a))
* **jobs:** cron secret generated in Supabase Vault, read by the API ([678072f](https://github.com/alwaysfoundation/always-platform/commit/678072f9061a4584d812bcd4a82a74c971d30fc5))
* **ops:** foundation team queue for church claims, events and feedback ([4b8561b](https://github.com/alwaysfoundation/always-platform/commit/4b8561bd6a18416de2d4b9263f3f0f580619495e))
* **reports:** simple, privacy-safe reports for ministries and funders ([d3d015d](https://github.com/alwaysfoundation/always-platform/commit/d3d015d624113eaed2cad531ab13dde9656efc2a))
* **reports:** simple, privacy-safe reports for ministries and funders ([2a26e77](https://github.com/alwaysfoundation/always-platform/commit/2a26e7738ce5ec2f095e63b430f600a75c659572))
* **web:** church inbox and foundation console ([add0a4d](https://github.com/alwaysfoundation/always-platform/commit/add0a4d0780c80d1bbc9d88ec0cb801d217e9db0))
* **web:** church inbox and foundation console ([81c9e94](https://github.com/alwaysfoundation/always-platform/commit/81c9e94f6f49e0dbec636c2303ea7a47f114ce6d))


### Bug Fixes

* **api:** outbox rows use the app clock; DCO checks the PR's own commits ([4ef7bc9](https://github.com/alwaysfoundation/always-platform/commit/4ef7bc97e9f1497732bc3b1c365ddecf7194146d))
* **api:** outbox rows use the app clock; DCO checks the PR's own commits ([865f326](https://github.com/alwaysfoundation/always-platform/commit/865f3263148004c1719b91db294186a3545d80aa))
* **compliance:** match script and style end tags with spaces or attributes ([c400b63](https://github.com/alwaysfoundation/always-platform/commit/c400b63fff7cc4b2bf64e196819bf3c3dcae4864))
* **db:** org_readiness runs with the caller's permissions ([13531b4](https://github.com/alwaysfoundation/always-platform/commit/13531b40cbf903ab58c72f863513b3dfbe975224))
* **db:** pin search_path on reporting functions ([b124929](https://github.com/alwaysfoundation/always-platform/commit/b1249291bdf770b36d9a8055080e2adf832c6e47))
* **db:** pin search_path on row-level security functions ([5e3ff6c](https://github.com/alwaysfoundation/always-platform/commit/5e3ff6c7cf0ecbd4d899f19803382e284bbe0548))
* **deps:** next 15.5.29 and patched hono and sharp ([9bbc290](https://github.com/alwaysfoundation/always-platform/commit/9bbc2906cb3702206d69f470795d5040f1262c00))
* **deps:** zod 4 (no patched zod 3 release) ([d3e82df](https://github.com/alwaysfoundation/always-platform/commit/d3e82df6a77e2cabe81e97726540e3c9322ff573))
* patched postcss, and a test clock that never falls behind real time ([9e21515](https://github.com/alwaysfoundation/always-platform/commit/9e215159f504f6167d2146859033f7f0e2b9a7d3))
* **templates:** calmer subjects, no timing in alerts or texts ([9d73594](https://github.com/alwaysfoundation/always-platform/commit/9d735943fd316fd1bea2bfd622a29500c3de5c12))
