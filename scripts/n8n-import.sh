#!/bin/sh
# n8n workflow import script
# Runs as init container after n8n is healthy
# Imports workflow JSON files from /home/node/workflows/

set -e

echo "=== n8n Workflow Import ==="

WORKFLOW_DIR="/home/node/workflows"

if [ ! -d "$WORKFLOW_DIR" ]; then
  echo "No workflow directory found at $WORKFLOW_DIR"
  exit 0
fi

# Count JSON files
FILE_COUNT=$(find "$WORKFLOW_DIR" -name "*.json" -not -name "*.bak" | wc -l)
echo "Found $FILE_COUNT workflow files"

if [ "$FILE_COUNT" -eq 0 ]; then
  echo "No workflow files to import"
  exit 0
fi

# Import each workflow
for f in "$WORKFLOW_DIR"/*.json; do
  # Skip backup files
  case "$f" in
    *.bak) continue ;;
  esac

  BASENAME=$(basename "$f")
  echo "Importing: $BASENAME"

  # Use n8n CLI to import
  n8n import:workflow --input="$f" 2>&1 || {
    echo "Warning: Failed to import $BASENAME (may already exist)"
  }
done

echo "=== Import complete ==="
