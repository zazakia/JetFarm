# OTA Staged Rollout Pipeline — Viterbo Foods OPC
## Safe App Updates for 39 Branch Tablets

---

## Rollout Stages

### Stage 1: Canary (3 Pilot Branches)
**Branches:** Bagacay (Jumar), Tayasan (Baby Ann), Sagay 1 (Renor)
**Wait:** 48 hours
**Monitor:** Crash rate, sync success %, cash drawer accuracy

```bash
# Push to canary channel only
eas update --branch canary --message "v2.x.x - description"
```

### Stage 2: Early Adopter (12 Branches)
**Branches:** All supervisor HQ branches + high-volume stores
**Wait:** 24 hours

```bash
eas update --branch early-adopter --message "v2.x.x - description"
```

### Stage 3: Full Fleet (Remaining 24 Branches)

```bash
eas update --branch production --message "v2.x.x - description"
```

## Rollback Procedure

```bash
# Revert to previous update
eas update:rollback --branch production
# All tablets download previous version on next app open
# Local WatermelonDB data is preserved (no wipe)
```

## Schema Migration Warning

> **CRITICAL:** If the update includes a WatermelonDB schema migration (e.g. v25 → v26),
> rollback is NOT possible without wiping local data. Always test schema migrations
> on Stage 1 canary branches for 48 hours before proceeding.

## Channel Assignment per Branch

| Channel | Branches | Count |
|:---|:---|:---:|
| `canary` | Bagacay, Tayasan, Sagay 1 | 3 |
| `early-adopter` | Bacong 1, Bindoy 1, Bayawan, Mabinay 1, San Carlos 1, Locsin, NOPH, Tanjay 1, Manjuyod | 9 |
| `production` | All remaining branches | 27 |
