# On-prem release pipeline

This directory builds **versioned, signed release bundles** for TaskMaster on-prem.

- See [`RELEASING.md`](./RELEASING.md) for the full runbook.
- One-line release: `./bump-version.sh minor && git commit -am "chore: release" && git tag v$(cat VERSION) && git push --tags`
- CI does the rest.

| File | Role |
|------|------|
| `VERSION` | Current release version (single source of truth) |
| `MIN_PREVIOUS_VERSION` | Oldest version that may upgrade to current |
| `build-bundle.sh` | Build + sign + manifest |
| `bump-version.sh` | Semver bump + doc stamp |
| `update-docs.sh` | Rewrites version strings across docs |
| `generate-manifest.sh` | Emits `manifest.json` |
| `generate-changelog.sh` | Conventional commits → CHANGELOG |
| `sign-bundle.sh` | Detached openssl signature |
