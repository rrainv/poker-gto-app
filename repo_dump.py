from pathlib import Path
from collections import defaultdict

# ============================================================
# Riverline AI Architecture Dump
# ============================================================
#
# Goal:
#   Include first-party Riverline source, tests, configs and useful docs.
#
#   Exclude:
#   - packaged Electron / Chromium output
#   - binaries
#   - models/checkpoints
#   - node_modules
#   - licenses / third-party notices
#   - generated files
#   - giant historical/noisy files
#
# This is intended for architecture/code review by LLMs.
# ============================================================

ROOT = Path(".").resolve()
OUTPUT_FILE = ROOT / "repo_dump.txt"


# ============================================================
# 1. DIRECTORIES TO IGNORE COMPLETELY
# ============================================================

IGNORE_DIR_NAMES = {
    # Version control / IDE
    ".git",
    ".idea",
    ".vscode",

    # Python caches / environments
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "venv",
    ".venv",
    "env",

    # JavaScript dependencies
    "node_modules",

    # Build / package output
    "dist",
    "build",
    "release",
    "out",
    "coverage",

    # VERY IMPORTANT:
    # packaged Electron application output
    "dist-app",
    "win-unpacked",
    "linux-unpacked",
    "mac",
    "mac-arm64",
    "win-ia32-unpacked",
    "win-x64-unpacked",

    # Generated Electron / Chromium resources
    "locales",

    # Local configuration area intentionally excluded from architecture dumps.
    ".codex",

    # ML / generated artifacts
    "checkpoints",
    "datasets",
    "runs",
    "wandb",

    # Temporary/cache material
    "tmp",
    "temp",
    "logs",
    ".cache",
}


# ============================================================
# 2. SOURCE EXTENSIONS WE ACTUALLY CARE ABOUT
# ============================================================

SOURCE_EXTENSIONS = {
    ".js",
    ".mjs",
    ".cjs",
    ".py",
    ".html",
    ".css",
    ".md",
    ".toml",
    ".yaml",
    ".yml",
}


# ============================================================
# 3. IMPORTANT JSON FILES
# ============================================================
#
# Do NOT dump every JSON file.
# Models/data/generated JSON can become enormous.
# ============================================================

IMPORTANT_JSON_FILENAMES = {
    "package.json",
    "jsconfig.json",
    "tsconfig.json",
}

IMPORTANT_JSON_KEYWORDS = {
    "config",
    "schema",
    "metadata",
    "manifest",
}


# ============================================================
# 4. FILES TO IGNORE
# ============================================================

IGNORE_FILENAMES = {
    OUTPUT_FILE.name,

    # Dependency lockfiles
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",

    # Giant generated legal blobs
    "LICENSES.chromium.html",
    "LICENSES.html",
    "LICENSES.txt",
    "THIRD_PARTY_LICENSES",
    "THIRD_PARTY_LICENSES.txt",
    "THIRD_PARTY_NOTICES",
    "THIRD_PARTY_NOTICES.txt",

    # OS junk
    ".DS_Store",
    "Thumbs.db",
}

SENSITIVE_FILES = {
    Path("app/auth-config.js"),
    Path(".codex/config.toml"),
}

SENSITIVE_EXPLICIT_FILENAMES = {
    ".env",
    "app/auth-config.js",
    ".codex/config.toml",
    "repo_dump.txt",
}

SENSITIVE_CREDENTIAL_BASENAMES = {
    "credentials.json",
    "credential.json",
    "service-account.json",
    "service_account.json",
    "private-key.json",
    "private_key.json",
    "client-secret.json",
    "client_secret.json",
    "access-token.json",
    "api-key.json",
    "api_key.json",
    "oauth-token.json",
}

SENSITIVE_BINARY_EXTENSIONS = {
    ".pem",
    ".key",
    ".p12",
    ".pfx",
    ".crt",
    ".der",
    ".jwk",
}


def is_sensitive_local_config_path(path: Path) -> bool:
    """
    Return True when a path should be excluded because it is clearly local
    private configuration, not because it happens to include common security
    words in normal first-party source names.
    """

    rel = relative(path)
    name = rel.name.lower()
    posix = rel.as_posix().lower()

    if rel in SENSITIVE_FILES:
        return True

    if name == ".env" or name.startswith(".env."):
        return True

    if posix in SENSITIVE_EXPLICIT_FILENAMES:
        return True

    if name in SENSITIVE_CREDENTIAL_BASENAMES:
        return True

    return False


# Catch variant generated license filenames.
IGNORE_FILENAME_KEYWORDS = {
    "licenses.chromium",
    "third_party_license",
    "third-party-license",
    "third_party_notice",
    "third-party-notice",
}


# ============================================================
# 5. BINARY / GENERATED EXTENSIONS
# ============================================================

IGNORE_SUFFIXES = {
    # Executables / native libraries
    ".exe",
    ".dll",
    ".so",
    ".dylib",

    # Chromium / Electron package files
    ".pak",
    ".dat",
    ".bin",

    # ML / runtime binaries
    ".onnx",
    ".wasm",

    # Compiled Python
    ".pyc",
    ".pyo",

    # Source maps / minified vendor bundles
    ".map",
    ".min.js",
    ".min.css",

    # Archives
    ".zip",
    ".7z",
    ".tar",
    ".gz",

    # Media
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".svgz",

    # Documents not useful to code architecture
    ".pdf",
    ".docx",
    ".xlsx",
    ".pptx",
}


# ============================================================
# 6. CRITICAL FILES THAT MUST NEVER BE LOST TO SIZE FILTERS
# ============================================================

FORCE_INCLUDE = {
    Path("AGENTS.md"),
    Path("README.md"),

    Path("app/index.html"),
    Path("app/src/core/logic.js"),

    Path("package.json"),
    Path("app/package.json"),
    Path("app/auth-config.example.js"),
}


# ============================================================
# 7. SIZE POLICY
# ============================================================
#
# Important difference from your old generator:
#
# logic.js and other real first-party source are NOT thrown away
# just because they exceed 250 KB.
#
# But giant docs/config/data still get filtered.
# ============================================================

MAX_SOURCE_BYTES = 2 * 1024 * 1024       # 2 MB
MAX_MARKDOWN_BYTES = 180 * 1024          # 180 KB
MAX_JSON_BYTES = 250 * 1024              # 250 KB


# ============================================================
# 8. OPTIONAL HISTORICAL DOC FILTER
# ============================================================
#
# If old experimental docs consume too much context, list them here.
# This does NOT delete them from the repo.
#
# Example:
#
# OPTIONAL_SKIP_DOCS = {
#     Path("docs/legacy/old_deepcfr_postmortem.md"),
# }
# ============================================================

OPTIONAL_SKIP_DOCS = set()


# ============================================================
# HELPERS
# ============================================================

def relative(path: Path) -> Path:
    return path.resolve().relative_to(ROOT)


def path_contains_ignored_dir(path: Path) -> bool:
    return any(part in IGNORE_DIR_NAMES for part in path.parts)


def is_force_included(path: Path) -> bool:
    return relative(path) in FORCE_INCLUDE


def has_ignored_suffix(path: Path) -> bool:
    lower = path.name.lower()

    return any(
        lower.endswith(suffix.lower())
        for suffix in IGNORE_SUFFIXES
    )


def filename_is_noise(path: Path) -> bool:
    if is_sensitive_local_config_path(path):
        return True

    if path.name in IGNORE_FILENAMES:
        return True

    name_lower = path.name.lower()

    if path.suffix.lower() in SENSITIVE_BINARY_EXTENSIONS:
        return True

    if any(
        keyword in name_lower
        for keyword in IGNORE_FILENAME_KEYWORDS
    ):
        return True

    return False


def is_useful_json(path: Path) -> bool:
    if path.name in IMPORTANT_JSON_FILENAMES:
        return True

    stem = path.stem.lower()

    return any(
        keyword in stem
        for keyword in IMPORTANT_JSON_KEYWORDS
    )


def allowed_extension(path: Path) -> bool:
    suffix = path.suffix.lower()

    if suffix in SOURCE_EXTENSIONS:
        return True

    if suffix == ".json":
        return is_useful_json(path)

    return False


def size_limit_for(path: Path) -> int:
    suffix = path.suffix.lower()

    if suffix == ".md":
        return MAX_MARKDOWN_BYTES

    if suffix == ".json":
        return MAX_JSON_BYTES

    return MAX_SOURCE_BYTES


def should_include(path: Path):
    """
    Returns:
        (True, reason)
        (False, reason)
    """

    rel = relative(path)

    # Never recursively dump the dump.
    if path == OUTPUT_FILE:
        return False, "output-file"

    if rel in SENSITIVE_FILES:
        return False, "sensitive-local-config"

    # Explicit optional historical exclusions.
    if rel in OPTIONAL_SKIP_DOCS:
        return False, "historical-doc-filter"

    # Keep known first-party examples and templates even if they
    # include sensitive-looking keywords in their names.
    if is_force_included(path):
        return True, "forced-critical"

    # Generated/package directories.
    if path_contains_ignored_dir(rel):
        return False, "ignored-directory"

    # Specific noise files.
    if filename_is_noise(path):
        return False, "ignored-file"

    # Binaries/vendor-generated content.
    if has_ignored_suffix(path):
        return False, "binary-or-generated"

    # Only useful source/config types.
    if not allowed_extension(path):
        return False, "unsupported-extension"

    try:
        size = path.stat().st_size
    except OSError:
        return False, "stat-error"

    limit = size_limit_for(path)

    if size > limit:
        return False, f"oversized>{limit}"

    return True, "source"


def read_text(path: Path):
    """
    Try multiple likely source encodings.

    Useful because some old Riverline HTML files were UTF-16.
    """

    encodings = (
        "utf-8",
        "utf-8-sig",
        "utf-16",
        "utf-16-le",
        "utf-16-be",
        "cp1252",
    )

    errors = []

    for encoding in encodings:
        try:
            text = path.read_text(encoding=encoding)

            # Protect against accidentally interpreting binary as text.
            if "\x00" in text:
                errors.append(f"{encoding}: contains NUL bytes")
                continue

            return text, encoding

        except Exception as exc:
            errors.append(f"{encoding}: {exc}")

    raise UnicodeError("; ".join(errors))


# ============================================================
# GENERATOR
# ============================================================

def generate_dump():

    candidates = sorted(
        [
            path
            for path in ROOT.rglob("*")
            if path.is_file()
        ],
        key=lambda p: relative(p).as_posix().lower(),
    )

    accepted = []
    skipped = defaultdict(list)

    for path in candidates:
        include, reason = should_include(path)

        if include:
            accepted.append((path, reason))
        else:
            skipped[reason].append(path)

    actual_files = []
    decode_failures = []

    total_source_bytes = 0
    total_source_lines = 0

    with OUTPUT_FILE.open(
        "w",
        encoding="utf-8",
        newline="\n",
    ) as out:

        # ----------------------------------------------------
        # Header
        # ----------------------------------------------------

        out.write(
            "RIVERLINE ARCHITECTURE-FOCUSED REPOSITORY DUMP\n"
        )
        out.write("=" * 72 + "\n\n")

        out.write(
            "Purpose: AI architecture/code review.\n"
        )
        out.write(
            "Contains first-party Riverline source, tests, configs, "
            "and useful documentation.\n"
        )
        out.write(
            "Electron/Chromium packaged output, binaries, models, "
            "third-party licenses, dependencies, and generated "
            "artifacts are intentionally excluded.\n\n"
        )

        # ----------------------------------------------------
        # Actual source
        # ----------------------------------------------------

        for path, reason in accepted:

            rel = relative(path)

            try:
                text, encoding = read_text(path)

            except Exception as exc:
                decode_failures.append(
                    (rel, str(exc))
                )
                continue

            size = path.stat().st_size
            lines = text.count("\n") + 1

            total_source_bytes += size
            total_source_lines += lines

            actual_files.append(
                (
                    rel,
                    size,
                    lines,
                    encoding,
                    reason,
                )
            )

            out.write("\n")
            out.write("=" * 72 + "\n")
            out.write(
                f"File: {rel.as_posix()}\n"
            )
            out.write(
                f"Size: {size:,} bytes | "
                f"Lines: {lines:,} | "
                f"Encoding: {encoding}\n"
            )
            out.write("=" * 72 + "\n\n")

            out.write(text)

            if not text.endswith("\n"):
                out.write("\n")

        # ----------------------------------------------------
        # Concise manifest
        # ----------------------------------------------------

        out.write("\n\n")
        out.write("#" * 72 + "\n")
        out.write("DUMP MANIFEST\n")
        out.write("#" * 72 + "\n\n")

        out.write(
            f"Included files: {len(actual_files):,}\n"
        )
        out.write(
            f"Included lines: {total_source_lines:,}\n"
        )
        out.write(
            f"Original source size: "
            f"{total_source_bytes / 1024 / 1024:.2f} MiB\n"
        )

        # Important:
        # Do NOT enumerate every ignored binary from win-unpacked.
        # That would itself waste context.
        out.write("\nSKIPPED COUNTS\n")
        out.write("-" * 72 + "\n")

        for reason in sorted(skipped):
            out.write(
                f"{reason}: {len(skipped[reason]):,} files\n"
            )

        if decode_failures:
            out.write("\nDECODE FAILURES\n")
            out.write("-" * 72 + "\n")

            for rel, error in decode_failures:
                out.write(
                    f"{rel.as_posix()}: {error}\n"
                )

        # List ONLY important oversized source omissions.
        oversized = [
            path
            for reason, paths in skipped.items()
            if reason.startswith("oversized>")
            for path in paths
        ]

        if oversized:
            out.write(
                "\nOVERSIZED SOURCE/DOC FILES OMITTED\n"
            )
            out.write("-" * 72 + "\n")

            for path in oversized:
                rel = relative(path)
                size = path.stat().st_size

                out.write(
                    f"{rel.as_posix()} "
                    f"({size / 1024:.1f} KiB)\n"
                )

    # ========================================================
    # Terminal summary
    # ========================================================

    dump_size = OUTPUT_FILE.stat().st_size

    print()
    print("=" * 60)
    print("Riverline architecture dump complete")
    print("=" * 60)

    print(
        f"Output file:     {OUTPUT_FILE.name}"
    )
    print(
        f"Included files:  {len(actual_files):,}"
    )
    print(
        f"Included lines:  {total_source_lines:,}"
    )
    print(
        f"Dump size:       {dump_size / 1024 / 1024:.2f} MiB"
    )

    print()

    # --------------------------------------------------------
    # Confirm critical architecture files
    # --------------------------------------------------------

    included_rel = {
        rel
        for rel, *_ in actual_files
    }

    missing_critical = []

    for critical in FORCE_INCLUDE:
        full = ROOT / critical

        if (
            full.exists()
            and critical not in included_rel
        ):
            missing_critical.append(critical)

    if missing_critical:

        print(
            "WARNING: Critical files missing from dump:"
        )

        for path in missing_critical:
            print(f"  - {path.as_posix()}")

    else:
        print(
            "Critical architecture files present."
        )

    # --------------------------------------------------------
    # Useful statistics
    # --------------------------------------------------------

    print()
    print("Ignored generated/package material:")

    for reason in (
        "ignored-directory",
        "binary-or-generated",
        "ignored-file",
    ):
        count = len(skipped.get(reason, []))

        if count:
            print(
                f"  {reason}: {count:,}"
            )

    if decode_failures:
        print()
        print(
            f"WARNING: {len(decode_failures)} "
            f"text files could not be decoded."
        )


if __name__ == "__main__":
    generate_dump()
