import json
import os

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
