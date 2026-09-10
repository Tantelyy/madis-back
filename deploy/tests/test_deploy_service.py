"""Exercise the deployment shell script with Docker/lock commands mocked.

Run: python -m unittest discover -s deploy/tests -v
Requires Bash (Git Bash is supported on Windows). No VPS or Docker daemon used.
"""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'deploy-service.sh'
BASH = (r'C:\Program Files\Git\bin\bash.exe' if os.name == 'nt'
        else shutil.which('bash'))
NEW_IMAGE = 'ghcr.io/tantelyy/madis-back:sha-' + 'a' * 40
OLD_IMAGE = 'sha256:' + 'b' * 64
MOCK_SHELL = r'''
flock() { return 0; }
docker() {
  printf '%s\n' "$*" >> "$CALL_LOG"
  case "$*" in
    'inspect --format {{.Image}} old-container') printf '%s\n' "$OLD_IMAGE" ;;
    pull*) [ "$SCENARIO" != pull_failure ] ;;
    *'ps -q backend') echo old-container ;;
    *'up -d'*)
      if [ "$SCENARIO" = success ]; then return 0; fi
      if grep -q "^BACKEND_IMAGE=$OLD_IMAGE$" .versions.env; then
        [ "$SCENARIO" != rollback_failure ]
      else
        return 1
      fi
      ;;
    *) return 0 ;;
  esac
}
. ./deploy-service.sh
'''


class DeployServiceTests(unittest.TestCase):
    def run_scenario(self, scenario, image=NEW_IMAGE):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'deploy-service.sh').write_text(SCRIPT.read_text(), newline='\n')
            (root / '.env').write_text('DUMMY=1\n')
            versions = ('BACKEND_IMAGE=ghcr.io/tantelyy/madis-back:latest\n'
                        'FRONTEND_IMAGE=keep-frontend\nML_IMAGE=keep-ml\n')
            (root / '.versions.env').write_text(versions)
            env = dict(os.environ, SCENARIO=scenario, OLD_IMAGE=OLD_IMAGE,
                       CALL_LOG='calls.log')
            result = subprocess.run(
                [BASH, '-c', MOCK_SHELL, './deploy-service.sh', 'backend', image],
                cwd=root, env=env, capture_output=True, text=True, timeout=15,
            )
            actual = (root / '.versions.env').read_text()
            calls = (root / 'calls.log').read_text() if (root / 'calls.log').exists() else ''
            self.assertIn('FRONTEND_IMAGE=keep-frontend\n', actual)
            self.assertIn('ML_IMAGE=keep-ml\n', actual)
            self.assertNotIn('prune', calls)
            return result, actual, calls

    def test_success_updates_only_requested_service(self):
        result, versions, calls = self.run_scenario('success')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f'BACKEND_IMAGE={NEW_IMAGE}\n', versions)
        self.assertIn('--no-deps --pull never --wait --wait-timeout 180 backend', calls)

    def test_pull_failure_preserves_current_versions(self):
        result, versions, calls = self.run_scenario('pull_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('BACKEND_IMAGE=ghcr.io/tantelyy/madis-back:latest\n', versions)
        self.assertNotIn('up -d', calls)

    def test_health_failure_rolls_back_actual_image_even_when_tag_was_latest(self):
        result, versions, calls = self.run_scenario('health_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(f'BACKEND_IMAGE={OLD_IMAGE}\n', versions)
        self.assertEqual(calls.count('up -d'), 2)

    def test_rollback_failure_is_reported(self):
        result, _, _ = self.run_scenario('rollback_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Rollback did not become healthy', result.stderr)

    def test_wrong_repository_is_rejected_before_docker(self):
        result, _, calls = self.run_scenario('success', NEW_IMAGE.replace('madis-back', 'madis-front'))
        self.assertEqual(result.returncode, 2)
        self.assertEqual(calls, '')

    def test_malformed_tag_is_rejected(self):
        result, _, calls = self.run_scenario('success', NEW_IMAGE + '; echo invalid')
        self.assertEqual(result.returncode, 2)
        self.assertEqual(calls, '')


if __name__ == '__main__':
    unittest.main()
