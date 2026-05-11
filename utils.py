import json
import os

SESSIONS_DIR = "./sessions"
os.makedirs(SESSIONS_DIR, exist_ok=True)


def get_session_path(user_id):
    return os.path.join(SESSIONS_DIR, f"{user_id}.jsonl")


def load_session(user_id):
    """load conversation from history from disk"""
    path = get_session_path(user_id)
    messages = []
    if os.path.exists(path):
        with open(path, "r") as f:
            for line in f:
                if line.strip():
                    messages.append(json.loads(line))
    return messages


def append_to_session(user_id, message):
    """Append a single message to the session file."""
    path = get_session_path(user_id)
    with open(path, "a") as f:
        f.write(json.dumps(message) + "\n")


def save_session(user_id, messages):
    """overwrite the session file with full messages list"""
    path = get_session_path(user_id)
    with open(path, "w") as f:
        f.writelines(json.dumps(message) + "\n" for message in messages)
