#!/usr/bin/env bash
# PostCircECD Google Science Living Evidence Sync Script (MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md §7.1)
# Queries Europe PMC and ClinicalTrials.gov via the installed Google Science skills to fetch newly published
# evidence on PCA, DLB, lvPPA, and digital cognitive biomarkers into docs/evidence-feed.json.

set -euo pipefail

EPMC_SCRIPT="/Users/o2satz/.gemini/config/plugins/science/skills/literature_search_europepmc/scripts/europepmc_api.py"
CT_SCRIPT="/Users/o2satz/.gemini/config/plugins/science/skills/clinical_trials_database/scripts/clinical_trials_api.py"

mkdir -p docs

if [[ -f "$EPMC_SCRIPT" ]]; then
  echo "[PostCircECD] Syncing primary literature from Europe PMC..."
  uv run "$EPMC_SCRIPT" search --query '("posterior cortical atrophy" OR "Lewy body" OR "logopenic") AND ("visuoperceptual" OR "pareidolia" OR "speech")' --page-size 5 > docs/evidence-feed-epmc.json
fi

if [[ -f "$CT_SCRIPT" ]]; then
  echo "[PostCircECD] Syncing clinical trial status for NCT05607732 (MyCog)..."
  uv run "$CT_SCRIPT" get --nct-id NCT05607732 > docs/evidence-feed-clinicaltrials.json
fi

jq -n \
  --slurpfile epmc docs/evidence-feed-epmc.json \
  --slurpfile ct docs/evidence-feed-clinicaltrials.json \
  '{ syncedAt: (now | todate), europePmc: $epmc[0], clinicalTrials: $ct[0] }' > docs/evidence-feed.json 2>/dev/null || true

echo "[PostCircECD] Living Evidence feed updated in docs/evidence-feed.json."
