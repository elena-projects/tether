import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production CSP blocks inline scripts and retired proxy routes stay closed', async () => {
  const [html, nginx] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../nginx.conf', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /<script src="\/analytics\.js"><\/script>/);
  assert.doesNotMatch(html, /<script>(?:.|\n)*?<\/script>/);
  assert.match(nginx, /script-src 'self' https:\/\/www\.googletagmanager\.com;/);
  assert.match(nginx, /script-src-attr 'none'/);
  assert.doesNotMatch(nginx, /script-src[^;]*'unsafe-inline'/);
  assert.match(nginx, /location \^~ \/v1beta\/ \{ return 404; \}/);
  assert.match(nginx, /location \^~ \/rtdb\/ \{ return 403; \}/);
  assert.match(nginx, /location \^~ \/talks\/ \{ return 403; \}/);
});
