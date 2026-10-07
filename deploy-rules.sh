#!/bin/sh
# Deploy only Tether's Realtime Database rules.
set -e
cd "$(dirname "$0")"

export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-/opt/homebrew/bin/python3}"
account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
if [ "$account" != "elena@geminiat.work" ]; then
  echo "Expected active gcloud account elena@geminiat.work, found: $account" >&2
  exit 1
fi

token="$(gcloud auth print-access-token)"
TOKEN="$token" node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';

const rules = JSON.parse(await readFile('database.rules.json', 'utf8'));
const url = 'https://tether-7fc38-default-rtdb.asia-southeast1.firebasedatabase.app/.settings/rules.json';
const response = await fetch(url, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${process.env.TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(rules),
});
if (!response.ok) {
  const detail = (await response.text()).slice(0, 500);
  throw new Error(`Rules deployment failed (${response.status}): ${detail}`);
}
console.log('Firebase Realtime Database rules deployed successfully.');
NODE
