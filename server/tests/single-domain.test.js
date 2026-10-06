const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

let server;
let baseUrl;

before(async () => {
  const app = require('../src/app');
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => new Promise((resolve) => server.close(resolve)));

test('serves API and React routes from one origin', async () => {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'FoodBridge' });

  const unknownApi = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(unknownApi.status, 404);
  assert.match(unknownApi.headers.get('content-type'), /application\/json/);

  const frontendRoute = await fetch(`${baseUrl}/login`);
  assert.equal(frontendRoute.status, 200);
  assert.match(await frontendRoute.text(), /<div id="root"><\/div>/);
});
