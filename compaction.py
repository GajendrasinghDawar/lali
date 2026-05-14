import json

from ai_client import client
from utils import save_session


def estimate_tokens(messages):
    """rough token estimate 4 chars per token"""
    return sum(len(json.dumps(m)) for m in messages) // 4


def compact_session(user_id, messages):
    """Summarize old messages when context gets too long."""
    if estimate_tokens(messages) < 100_000:  # ~80% of a 128k window
        return messages  # No compaction needed

    split = len(messages) // 2
    old, recent = messages[:split], messages[split:]

    print("Compacting session history...")

    prompt = (
        "Summarize this conversation concisely. Preserve:\n"
        "- Key facts about the user (name, preferences)\n"
        "- Important decisions made\n"
        "- Open tasks or TODOs\n\n"
        f"{json.dumps(old, indent=2)}"
    )

    response = client.responses.create(
        model="gpt-5.1-codex-mini",
        max_output_tokens=2000,
        input=prompt,
    )

    summary_text = response.output_text

    compacted = [
        {"role": "user", "content": f"[Previous conversation summary]\n{summary_text}"}
    ] + recent

    save_session(user_id, compacted)
    return compacted
