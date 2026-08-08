import os

# ---------------------------------------------------------
# Configuration (Web Only - Desktop Boilerplate Excluded)
# ---------------------------------------------------------
OUTPUT_FILE = "repo_dump.txt"

# Directories to completely ignore
IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", "venv", ".venv", 
    ".vscode", "env", "dist", "build", "electron", "desktop"
}

# Strict extensions (Only core web files and python backend)
ALLOWED_EXTENSIONS = {".js", ".html", ".css", ".py"}

# Files specifically related to desktop/Electron wrapper to skip
IGNORE_FILES = {"main.js", "preload.js", "electron.js", "desktop.js", "package.json"}

# Maximum file size: 250 KB (skips massive libraries and data arrays)
MAX_FILE_SIZE_BYTES = 250 * 1024 

def generate_dump():
    print(f"Scanning directory for core web & python files (ignoring desktop wrappers)...\n")
    
    skipped_count = 0
    with open(OUTPUT_FILE, "w", encoding="utf-8") as outfile:
        for root, dirs, files in os.walk("."):
            # Modify dirs in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                # Skip desktop-specific wrapper files
                if file in IGNORE_FILES:
                    continue

                if any(file.endswith(ext) for ext in ALLOWED_EXTENSIONS):
                    filepath = os.path.join(root, file)
                    
                    # Size check to prevent massive files from breaking the AI context
                    file_size = os.path.getsize(filepath)
                    if file_size > MAX_FILE_SIZE_BYTES:
                        print(f"⚠️ Skipping massive file: {filepath} ({file_size / 1024:.1f} KB)")
                        skipped_count += 1
                        continue
                    
                    # Formatting the header
                    outfile.write(f"\n{'='*60}\n")
                    outfile.write(f"File: {filepath}\n")
                    outfile.write(f"{'='*60}\n\n")
                    
                    try:
                        with open(filepath, "r", encoding="utf-8") as infile:
                            outfile.write(infile.read())
                            outfile.write("\n")
                    except Exception as e:
                        outfile.write(f"[Error reading file: {e}]\n")

    print(f"\nSuccess! Core code combined into: {OUTPUT_FILE} (Skipped {skipped_count} oversized files)")

if __name__ == "__main__":
    generate_dump()