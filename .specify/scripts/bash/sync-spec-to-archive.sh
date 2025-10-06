#!/usr/bin/env bash
# Auto-sync spec from current branch to specs-archive branch
# Ensures specs are never lost when switching branches

set -e

# Get repo root
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Don't sync if we're already on specs-archive
if [ "$CURRENT_BRANCH" = "specs-archive" ]; then
    echo "Already on specs-archive, no sync needed"
    exit 0
fi

# Check if specs directory exists and has content
if [ ! -d "specs" ] || [ -z "$(ls -A specs 2>/dev/null)" ]; then
    echo "No specs to sync"
    exit 0
fi

# Check if specs-archive branch exists
if ! git show-ref --verify --quiet refs/heads/specs-archive; then
    echo "Creating specs-archive branch..."
    git branch specs-archive
    git push -u origin specs-archive 2>/dev/null || true
fi

# Stash current changes if any (we'll restore them later)
STASH_NEEDED=false
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "Stashing current changes..."
    git stash push -m "auto-stash before spec sync from $CURRENT_BRANCH"
    STASH_NEEDED=true
fi

# Switch to specs-archive
echo "Switching to specs-archive..."
git checkout specs-archive 2>/dev/null || git checkout -b specs-archive

# Copy specs from the feature branch
echo "Syncing specs from $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH" -- specs/ 2>/dev/null || true

# Commit if there are changes
if ! git diff-index --quiet HEAD -- specs/ 2>/dev/null; then
    git add specs/
    git commit -m "sync: Auto-sync specs from $CURRENT_BRANCH

Automatically synced by .specify/scripts/bash/sync-spec-to-archive.sh
to ensure specs are preserved across branch switches.
"

    # Push to remote
    git push origin specs-archive 2>/dev/null || echo "Warning: Could not push to remote"

    echo "✅ Specs synced to specs-archive"
else
    echo "No new changes to sync"
fi

# Switch back to original branch
echo "Returning to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"

# Restore stashed changes if we stashed
if [ "$STASH_NEEDED" = true ]; then
    echo "Restoring stashed changes..."
    git stash pop
fi

echo "✅ Sync complete"
