import unittest

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT))

import repo_dump


class RepoDumpFilterTests(unittest.TestCase):

    def test_sensitive_config_paths_are_marked_sensitive(self):
        repo_root = repo_dump.ROOT

        sensitive_paths = [
            repo_root / "app/auth-config.js",
            repo_root / ".codex/config.toml",
            repo_root / ".env.local",
            repo_root / "repo_dump.txt",
            repo_root / "app" / "private-key.json",
            repo_root / "app" / "service-account.json",
            repo_root / "app" / "credentials.json",
        ]

        for path in sensitive_paths:
            with self.subTest(path=path):
                self.assertTrue(
                    repo_dump.is_sensitive_local_config_path(path),
                    f"expected sensitive path: {path}",
                )

    def test_normal_auth_and_token_related_source_is_included(self):
        repo_root = repo_dump.ROOT

        for rel in [
            "app/auth-config.example.js",
            "app/src/application/authentication-service.mjs",
            "app/src/application/authentication-bootstrap.mjs",
            "tests/account002a_authentication.test.mjs",
            "tests/design002_theme_foundation.test.mjs",
            "app/styles.css",
            "app/src/core/logic.js",
            "docs/project/AUTHENTICATION_SPEC.md",
        ]:
            path = repo_root / rel
            with self.subTest(path=rel):
                included, reason = repo_dump.should_include(path)
                self.assertTrue(
                    included,
                    f"expected included: {rel}, got reason={reason}",
                )

    def test_token_like_file_names_do_not_trigger_sensitive_exclusion(self):
        repo_root = repo_dump.ROOT
        token_like_names = [
            repo_root / "app" / "strategy-token-metadata.mjs",
            repo_root / "tests" / "tokenized_flow.test.mjs",
            repo_root / "app" / "design-token-list.md",
            repo_root / "app" / "token-theme.css",
        ]

        for path in token_like_names:
            with self.subTest(path=path):
                self.assertFalse(
                    repo_dump.is_sensitive_local_config_path(path),
                    f"did not expect sensitive exclusion for token-like path: {path}",
                )


if __name__ == "__main__":
    unittest.main()
