import json
import os
import re

SAFE_COMMANDS = {"ls", "cat", "head", "tail", "wc", "date", "whoami", "echo"}
DANGEROUS_PATTERNS = [r"\brm\b", r"\bsudo\b", r"\bchmod\b", r"\bcurl.*\|.*sh"]

APPROVALS_FILE = "./exec-approvals.json"


def load_approvals():
    if os.path.exists(APPROVALS_FILE):
        with open(APPROVALS_FILE) as f:
            return json.load(f)

    return {"allowed": [], "denied": []}


def save_approval(command, approved):
    approvals = load_approvals()
    key = "allowed" if approved else "denied"
    if command not in approvals[key]:
        approvals[key].append(command)
    with open(APPROVALS_FILE, "w") as f:
        json.dump(approvals, f, indent=2)


def check_command_safety(command: str):
    """returns "safe" "approved" or "needs_approval" """
    base_cmd = command.strip().split()[0] if command.strip() else ""
    if base_cmd in SAFE_COMMANDS:
        return "safe"

    approvals = load_approvals()
    if command in approvals["allowed"]:
        return "approved"

    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, command):
            return "needs_approval"

    return "needs_approval"
