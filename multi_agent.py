from contants import SOUL

AGENTS = {
    "main": {
        "name": "lali",
        "soul": SOUL,  # our existing SOUL
        "session_prefix": "agent:main",
    },
    "researcher": {
        "name": "dhaniya",
        "soul": """You are Scout, a research specialist.
Your job: find information and cite sources. Every claim needs evidence.
Use tools to gather data. Be thorough but concise.
Save important findings to memory for other agents to reference.""",
        "session_prefix": "agent:researcher",
    },
}


def resolve_agent(message_text):
    """Route messages to the right agent based on prefix commands."""
    if message_text.startswith("/research "):
        return "researcher", message_text[len("/research ") :]
    return "main", message_text
