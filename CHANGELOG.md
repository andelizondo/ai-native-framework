# Changelog

## [0.5.1](https://github.com/andelizondo/ai-native-framework/compare/v0.5.0...v0.5.1) (2026-04-14)


### Bug Fixes

* **codecov:** remove duplicate products/dashboard path prefix ([#69](https://github.com/andelizondo/ai-native-framework/issues/69)) ([92940bd](https://github.com/andelizondo/ai-native-framework/commit/92940bde0225bdcb9b20692f35989455c1413aab))

## [0.5.0](https://github.com/andelizondo/ai-native-framework/compare/v0.4.0...v0.5.0) (2026-04-13)


### Features

* **quality:** implement Quality Standard and Phase 1 test infrastructure ([#65](https://github.com/andelizondo/ai-native-framework/issues/65)) ([89f1f84](https://github.com/andelizondo/ai-native-framework/commit/89f1f8425e40c96d2668dd973312dabee43f626c))

## [0.4.0](https://github.com/andelizondo/ai-native-framework/compare/v0.3.0...v0.4.0) (2026-04-13)


### Features

* **dashboard:** change Design phase color from purple to blue ([#63](https://github.com/andelizondo/ai-native-framework/issues/63)) ([576dcd6](https://github.com/andelizondo/ai-native-framework/commit/576dcd6ef20d42b278f311b6dbf0f0b05d5446ee))

## [0.3.0](https://github.com/andelizondo/ai-native-framework/compare/v0.2.0...v0.3.0) (2026-04-13)


### Features

* **dashboard:** make sidebar logo link to home page ([#61](https://github.com/andelizondo/ai-native-framework/issues/61)) ([d03f457](https://github.com/andelizondo/ai-native-framework/commit/d03f4577722c411622572f45da960eecffc0f653))

## [0.2.0](https://github.com/andelizondo/ai-native-framework/compare/v0.1.0...v0.2.0) (2026-04-13)


### Features

* **dashboard:** add initial product boilerplate and example spec ([#44](https://github.com/andelizondo/ai-native-framework/issues/44)) ([6ce55e4](https://github.com/andelizondo/ai-native-framework/commit/6ce55e45c99db76e21df74da6d758f2fd1dd8eba))
* **dashboard:** integrate PostHog analytics and Sentry abstraction layer ([#48](https://github.com/andelizondo/ai-native-framework/issues/48)) ([2c9239f](https://github.com/andelizondo/ai-native-framework/commit/2c9239fb76dd2a96afcea279a81b6f1445cb5ebf))
* encode versioning standards in framework and skip release-please PR reviews ([#58](https://github.com/andelizondo/ai-native-framework/issues/58)) ([02ff10d](https://github.com/andelizondo/ai-native-framework/commit/02ff10d624cae39d635d2190d23120659d0df4dd))
* **framework:** analytics standard, feature request template, and implementation playbook ([#49](https://github.com/andelizondo/ai-native-framework/issues/49)) ([77de259](https://github.com/andelizondo/ai-native-framework/commit/77de2590f8d41174c9b82093d74c34ce94eb301c))
* **observability:** structured log pipeline via Sentry Logs ([#50](https://github.com/andelizondo/ai-native-framework/issues/50)) ([d48c2d6](https://github.com/andelizondo/ai-native-framework/commit/d48c2d6a1b31cf22cc037a77f41bc67a46ce5bb4))
* **observability:** wire structured logger into all request paths ([#51](https://github.com/andelizondo/ai-native-framework/issues/51)) ([038f33f](https://github.com/andelizondo/ai-native-framework/commit/038f33faadcc5673e7fc8a618f2d60c4a074561f))
* **p1:** residual risk, branch sync, autofix, and policy orchestration ([#13](https://github.com/andelizondo/ai-native-framework/issues/13)) ([5ef4bf4](https://github.com/andelizondo/ai-native-framework/commit/5ef4bf4a5adc7b69523f3686b99a1cf85d587125))


### Bug Fixes

* correct CodeRabbit ignore pattern for release-please PRs ([#59](https://github.com/andelizondo/ai-native-framework/issues/59)) ([6571773](https://github.com/andelizondo/ai-native-framework/commit/6571773862ec604a926c2a2ac48f132661880c30))
* **p1-policy:** dedupe concurrent decide runs per head SHA ([#29](https://github.com/andelizondo/ai-native-framework/issues/29)) ([5e98058](https://github.com/andelizondo/ai-native-framework/commit/5e98058a344295d0a6e63902267c0f9227fcbf44))
* **p1-policy:** deduplicate AI reviews per reviewer before fallback check ([f7d9038](https://github.com/andelizondo/ai-native-framework/commit/f7d903895e830604c5ad8ccf769bee65f92e477b))
* **p1-policy:** poll for residual:* labels in decide ([227d6a2](https://github.com/andelizondo/ai-native-framework/commit/227d6a215b35a83d8d3e7bebc25059968819e817))
* **p1-policy:** poll reviewer status with shared wait budget ([#26](https://github.com/andelizondo/ai-native-framework/issues/26)) ([7f60d1e](https://github.com/andelizondo/ai-native-framework/commit/7f60d1e747ad2464d3dfa316c86d489e936f1101))
* **p1-policy:** validate wait + residual when reviewer is status-only ([#23](https://github.com/andelizondo/ai-native-framework/issues/23)) ([fa35b2d](https://github.com/andelizondo/ai-native-framework/commit/fa35b2d479440b93df1a78e46c513d8527c30337))
* **p1:** replace workflow_run with check_run; add concurrency groups ([40fc2e4](https://github.com/andelizondo/ai-native-framework/commit/40fc2e45308f10133ca83c13a805f2e1cc3e6732))
* remove workflow_run trigger entirely (check_run cannot replace it — GitHub Actions check_run events do not trigger workflows from Actions-created suites). Rely on existing pull_request_target:labeled + pull_request_review triggers, which cover all re-triggering paths. Add PR-number-keyed concurrency groups (cancel-in-progress: false on policy, true on classification). ([40fc2e4](https://github.com/andelizondo/ai-native-framework/commit/40fc2e45308f10133ca83c13a805f2e1cc3e6732))
