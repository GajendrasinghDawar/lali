import os
import subprocess

from openai.types.responses import FunctionToolParam

from permissions import check_command_safety

TOOLS: list[FunctionToolParam] = [
    {
        "type": "function",
        "name": "run_command",
        "description": "Run a shell command on the user's computer.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The command to run"},
            },
            "required": ["command"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "read_file",
        "description": "Read a file from the filesystem.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path to the file"},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "write_file",
        "description": "Write content to a file.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path to the file"},
                "content": {"type": "string", "description": "Content to write"},
            },
            "required": ["path", "content"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "web_search",
        "description": "Search the web for information.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "save_memory",
        "description": "Save important information to long-term memory. Use for user preferences, key facts, and anything worth remembering across sessions.",
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "Short label, e.g. 'user-preferences', 'project-notes'",
                },
                "content": {
                    "type": "string",
                    "description": "The information to remember",
                },
            },
            "required": ["key", "content"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "memory_search",
        "description": "Search long-term memory for relevant information. Use at the start of conversations to recall context.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to search for",
                }
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]

MEMORY_DIR = "./memory"


def execute_tool(name: str, args: dict) -> str:
    if name == "run_command":
        cmd = args["command"]
        safety = check_command_safety(cmd)
        if safety == "needs_approval":
            print(f"blocked: {cmd} needs approvals")
            return "Permission denied. Command requires approval."
        result = subprocess.run(
            args["command"],
            shell=True,
            check=False,  # let the LLM see failures
            capture_output=True,
            text=True,
            timeout=30,
            stdin=subprocess.DEVNULL,  # prevent hangs on commands that read stdin (e.g. Windows `date`)
        )
        return f"exit={result.returncode}\n{result.stdout}{result.stderr}"

    if name == "read_file":
        with open(args["path"], "r", encoding="utf-8") as f:
            return f.read()

    if name == "write_file":
        with open(args["path"], "w", encoding="utf-8") as f:
            f.write(args["content"])
        return f"Wrote to {args['path']}"

    if name == "web_search":
        # TODO: wire to a real search API
        return f"Search results for: {args['query']}"

    if name == "save_memory":
        os.makedirs(MEMORY_DIR, exist_ok=True)
        filepath = os.path.join(MEMORY_DIR, f"{args['key']}.md")
        with open(filepath, "w") as f:
            f.write(args["content"])
        return f"saved to memory:{args['key']}"

    if name == "memory_search":
        query = args["query"].lower()
        results = []

        if os.path.exists(MEMORY_DIR):
            for fname in os.listdir(MEMORY_DIR):
                if fname.endswith(".md"):
                    with open(os.path.join(MEMORY_DIR, fname), "r") as f:
                        content = f.read()
                    if any(word in content.lower() for word in query.split()):
                        results.append(f"--- {fname} ---\n{content}")
        return "\n\n".join(results) if results else "No matching memories found."

    return f"Unknown tool: {name}"


def serialize_output(output) -> list[dict]:
    """JSON-serializable copy of OpenAI Responses output items.

    Stores the full rich representation. Cleaning of output-only fields
    (e.g. `status`) happens at the API boundary — see `clean_for_input`
    in utils.py.
    """
    return [item.model_dump(exclude_none=True) for item in output]
