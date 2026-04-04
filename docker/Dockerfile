# ─── DriftCode Server Image ───────────────────────────────────────────────────
#
# Extends the official opencode image with:
#   - GitHub CLI (gh) — lets the AI agent run git/PR/issue operations
#   - git — pre-installed for clone + commit operations
#
# The official opencode image is at: ghcr.io/anomalyco/opencode
# DriftCode publishes this extended image as: ghcr.io/driftcode/server
#
# NOTE: This assumes an Ubuntu/Debian base. If opencode's official image
#       switches to Alpine, replace `apt-get` with `apk` calls.
# ─────────────────────────────────────────────────────────────────────────────

ARG OPENCODE_VERSION=latest
FROM ghcr.io/anomalyco/opencode:${OPENCODE_VERSION}

USER root

# Install GitHub CLI and ensure git is present
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        git && \
    # Add GitHub CLI apt repository
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
        https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*

# Copy and install entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Drop back to the non-root user that opencode's base image uses
USER node

EXPOSE 4096

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
