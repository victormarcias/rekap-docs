#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# Deploys (doesn't call) this repo as the "serve_rekap" Cloud Function.
# It only serves the app itself (public/) — the Rekap notes are fetched
# live from GitHub by the browser, not by this function, so only changes
# to this repo need a redeploy.
gcloud functions deploy serve_rekap \
  --project=master-config-506002 \
  --gen2 \
  --runtime=python312 \
  --region=us-east4 \
  --entry-point=serve_rekap \
  --trigger-http \
  --allow-unauthenticated \
  --source=.
