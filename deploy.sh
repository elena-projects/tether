#!/bin/sh
# Deploy Tether to Cloud Run.
#
# Tether only needs the private Portfolio proxy secret. Gemini runs in the Portfolio
# backend, and the paused Talks feature no longer has a database proxy.
set -e
cd "$(dirname "$0")"

export CLOUDSDK_PYTHON=/opt/homebrew/bin/python3   # gcloud crashes on the system Python 3.9

account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
if [ "$account" != "elena@geminiat.work" ]; then
  echo "Expected active gcloud account elena@geminiat.work, found: $account" >&2
  exit 1
fi

npm run build

# The bundle must never carry an API key.
if grep -rqE 'AQ\.[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}' dist/assets/ 2>/dev/null; then
  echo "ABORT: an API key ended up in dist/ — do not deploy this build." >&2
  exit 1
fi

gcloud run deploy tether \
  --source . \
  --project=m-gemini-1127 \
  --region=us-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --service-account=tether-runtime@m-gemini-1127.iam.gserviceaccount.com \
  --remove-env-vars=DATA_SECRET,GEMINI_API_KEY,TALKS_SECRET \
  --clear-volumes \
  --clear-volume-mounts \
  --port=8080
