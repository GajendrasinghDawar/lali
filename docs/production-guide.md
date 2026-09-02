# Lali Production Guide

## Unrestricted Agent Risk Profile
Lali deploys an unrestricted Pi agent alongside the Gateway. The Agent executes arbitrarily complex workflows requested by the owner, including generating code, running commands, and making network requests. This creates an inherent security boundary challenge. The accepted risk profile requires the Agent to run in a heavily unprivileged sandbox without root, sudo, or Docker socket access. Rely strictly on the Gateway for executing external writes (e.g. GitHub publishing, email) via the effect proposal and approval mechanism.

## Secret and Key Rotation Procedures
All integration secrets (e.g., Telegram Bot Token, GitHub Service Token, Resend API Key) reside exclusively in the Gateway's `.env` configuration file and are absent from the Agent's environment and memory.
If any token is suspected to be compromised:
1. Revoke the token immediately from the issuing platform.
2. Update the Gateway `.env` file with the new token.
3. Restart the Gateway service. The Agent process does not need an explicit restart as it does not hold these secrets.

## Branch Protection Expectations
The Gateway enforces secure publication of Git changes to private GitHub repositories through temporary authentication and explicitly validated `publish_pr` effects. However, the destination repository on GitHub should still have branch protection rules enabled on the `main` or `master` branch. Lali creates feature branches and opens Pull Requests. It is the repository owner's responsibility to review and merge them using standard branch protection criteria.

## Self-Deployment Prohibition
Lali Agents are strictly prohibited from automating the deployment of the Lali system itself. Do not ask the Agent to modify the live server's systemd services, PM2 configuration, Nginx settings, or its own source code in the active `src/` directory.

## Backup and Restore
Regular encrypted backups should be taken using the provided `scripts/backup.sh` utility. Restoring is performed with `scripts/restore.sh`. The `BACKUP_PASSPHRASE` must be securely stored and provided in the environment when running these scripts.
