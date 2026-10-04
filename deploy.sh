#!/bin/sh
# Deploy Tether to Cloud Run.
#
# No key is passed in: the service already holds GEMINI_API_KEY and TALKS_SECRET, and
# `--update-env-vars` is the only flag that would touch them, so leaving env alone keeps
# both intact. Passing GEMINI_API_KEY without TALKS_SECRET is safe for the same reason,
# but not needing either is safer still.
set -e
cd "$(dirname "$0")"

export CLOUDSDK_PYTHON=/opt/homebrew/bin/python3   # gcloud crashes on the system Python 3.9

npm run build

# The bundle must never carry the key — nginx injects it server-side at runtime.
if grep -rqE 'AQ\.[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}' dist/assets/ 2>/dev/null; then
  echo "ABORT: an API key ended up in dist/ — do not deploy this build." >&2
  exit 1
fi

gcloud run deploy tether \
  --source . \
  --region=us-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080
