import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./deploy.sh', import.meta.url), 'utf8');

test('the production env changes only after the new image migration succeeds', () => {
  const pull = source.indexOf('APP_IMAGE="$NEW_IMAGE" compose pull backend');
  const migrate = source.indexOf(
    'APP_IMAGE="$NEW_IMAGE" compose run --rm --no-deps -e DB_USER -e DB_PASSWORD backend'
  );
  const switchEnv = source.indexOf('sed -i "s|^APP_IMAGE=.*|APP_IMAGE=${NEW_IMAGE}|"');
  const restart = source.indexOf('compose up -d --remove-orphans');

  assert.ok(pull > 0, 'pull must explicitly use the new image');
  assert.ok(migrate > pull, 'migration must follow the pull');
  assert.ok(switchEnv > migrate, 'the env file must stay unchanged until migration succeeds');
  assert.ok(restart > switchEnv, 'the stack restarts only after the env switch');
});
