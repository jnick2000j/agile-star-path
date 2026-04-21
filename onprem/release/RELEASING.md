# Releasing TaskMaster On-Prem

End-to-end runbook for cutting a new versioned release.

## TL;DR

```bash
./onprem/release/bump-version.sh minor      # 1.3.0 → 1.4.0
git add -A && git commit -m "chore: release v1.4.0"
git tag v1.4.0 && git push origin main --tags
```

GitHub Actions builds, signs, and publishes the bundle to GitHub Releases.
Customers run `./scripts/pimp-cli download v1.4.0` and they're in.

---

## Prerequisites (one-time)

### 1. Generate release signing key

```bash
mkdir -p onprem/release/keys
openssl genpkey -algorithm RSA -out onprem/release/keys/release.priv.pem -pkeyopt rsa_keygen_bits:4096
openssl pkey  -in  onprem/release/keys/release.priv.pem -pubout -out onprem/keys/release.pub.pem
```

- `release.pub.pem` is committed (every customer install needs it to verify bundles).
- `release.priv.pem` **must never be committed**. It is `.gitignore`d.

### 2. Add the private key to GitHub Actions

1. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `RELEASE_PRIVATE_KEY`
3. Value: paste the contents of `release.priv.pem` (full PEM, including BEGIN/END lines)

CI will write it to a temp file at build time and clean it up after signing.

### 3. Conventional commits

For the auto-generated changelog to be useful, write commits as:

```
feat: add SAML group sync
fix(billing): correct trial expiry calculation
chore: bump dependencies
docs: clarify air-gapped install
```

Anything not matching falls under "Uncategorised" in the changelog.

---

## Cutting a release

### Option A — semantic bump (recommended)

```bash
./onprem/release/bump-version.sh patch      # 1.3.0 → 1.3.1
./onprem/release/bump-version.sh minor      # 1.3.0 → 1.4.0
./onprem/release/bump-version.sh major      # 1.3.0 → 2.0.0
```

This:
- updates `onprem/release/VERSION`
- rewrites version strings in install/upgrade docs
- writes `onprem/docs/CURRENT_VERSION.md`
- updates root `package.json` version

### Option B — explicit version

```bash
./onprem/release/bump-version.sh 1.4.0-beta.1
```

### Then tag and push

```bash
git add -A && git commit -m "chore: release v1.4.0"
git tag v1.4.0
git push origin main --tags
```

The `release.yml` workflow triggers on the tag push and:

1. Logs in to `ghcr.io`
2. Pulls `ghcr.io/<owner>/taskmaster/{edge,web,kong}:v1.4.0`
3. Runs `build-bundle.sh`:
   - builds web bundle with `VITE_APP_VERSION=1.4.0` and `VITE_DEPLOYMENT_MODE=on_prem`
   - copies migrations and onprem scripts/docs/seed
   - exports docker images to tar files
   - generates `manifest.json` (version, checksum, min_previous_version, migration list, image digests)
   - signs the tarball with the release private key
   - generates `CHANGELOG-v1.4.0.md` from conventional commits
4. Creates a **GitHub Release** with:
   - `taskmaster-v1.4.0.tar.gz`
   - `taskmaster-v1.4.0.tar.gz.sig`
   - `taskmaster-v1.4.0.tar.gz.sha256`
   - `manifest-v1.4.0.json`
   - changelog as the release body

---

## Customer install / upgrade flow

### Greenfield

```bash
git clone https://github.com/<owner>/taskmaster-onprem.git /opt/taskmaster
cd /opt/taskmaster
./scripts/pimp-cli download v1.4.0
./scripts/pimp-cli verify   v1.4.0
cp .env.example .env && $EDITOR .env
./scripts/install.sh
```

### Upgrade

```bash
cd /opt/taskmaster
./scripts/pimp-cli download v1.4.0
./scripts/pimp-cli verify   v1.4.0
./scripts/pimp-cli upgrade  v1.4.0
```

### Air-gapped

1. Download `taskmaster-v1.4.0.tar.gz` + `.sig` from GitHub Releases on a connected machine.
2. Transfer both to the install host (USB, internal mirror, etc.).
3. Drop them in `bundles/` and run `verify` + `install.sh` (or `upgrade`).

The bundle is **fully self-contained** — no further internet access required.

---

## Skipping versions

`manifest.json` declares `min_previous_version`. To bump it (e.g., a release breaks compat with anything older than 1.2.0):

```bash
echo "1.2.0" > onprem/release/MIN_PREVIOUS_VERSION
```

Customers on older versions will see an explicit error from `upgrade.sh` and be told to upgrade incrementally.

---

## Local test build (without pushing a tag)

```bash
SKIP_IMAGES=1 VERSION=1.4.0-rc.1 \
  RELEASE_PRIVATE_KEY_FILE=./onprem/release/keys/release.priv.pem \
  ./onprem/release/build-bundle.sh
```

Output lands in `onprem/release/dist/`. `SKIP_IMAGES=1` skips docker pull/save so you can iterate fast on the bundle layout.

---

## Hotfix flow

1. Branch from the affected tag: `git checkout -b hotfix/1.3.x v1.3.0`
2. Apply the fix.
3. `./onprem/release/bump-version.sh patch` → `1.3.1`
4. Tag and push: `git tag v1.3.1 && git push origin hotfix/1.3.x --tags`
5. CI publishes `v1.3.1` as a separate release.
6. Forward-port the fix to `main`.

---

## Rotating the signing key

1. Generate a new keypair as in Prerequisites step 1.
2. Update `onprem/keys/release.pub.pem` and commit (next bundle will be verifiable with the new key).
3. Update the `RELEASE_PRIVATE_KEY` GitHub Actions secret.
4. Communicate to customers: any release tagged before the rotation will fail verification on a freshly-cloned install. Provide them the old `release.pub.pem` if they need to verify older bundles.

---

## Files in this pipeline

| Path | Purpose |
|------|---------|
| `onprem/release/VERSION` | Source of truth for current release version |
| `onprem/release/MIN_PREVIOUS_VERSION` | Floor for upgrade compatibility |
| `onprem/release/build-bundle.sh` | End-to-end build + sign |
| `onprem/release/sign-bundle.sh` | openssl sha256 detached signature |
| `onprem/release/generate-manifest.sh` | Emits `manifest.json` |
| `onprem/release/generate-changelog.sh` | Conventional-commits → markdown |
| `onprem/release/bump-version.sh` | Semantic bump + doc rewrite |
| `onprem/release/update-docs.sh` | Rewrites version refs in docs |
| `.github/workflows/release.yml` | Tag → build → sign → publish |
| `onprem/keys/release.pub.pem` | Public key shipped to every customer |
