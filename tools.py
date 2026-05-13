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
]


def execute_tool(name: str, args: dict) -> str:
    if name == "run_command":
        cmd = args["command"]
        safety = check_command_safety(cmd)
        if safety == 'needs_approval':
            print(f'blocked: {cmd} needs approvals')
            return 'Permission denied. Command requires approval.'
        result = subprocess.run(
            args["command"],
            shell=True,
            check=False,  # let the LLM see failures
            capture_output=True,
            text=True,
            timeout=30,
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

    return f"Unknown tool: {name}"


def serialize_output(output) -> list[dict]:
    """JSON-serializable copy of OpenAI Responses output items.

    Stores the full rich representation. Cleaning of output-only fields
    (e.g. `status`) happens at the API boundary — see `clean_for_input`
    in utils.py.
    """
    return [item.model_dump(exclude_none=True) for item in output]
