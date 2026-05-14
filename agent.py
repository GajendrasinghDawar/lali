import json

from ai_client import client
from tools import TOOLS, execute_tool, serialize_output
from utils import clean_for_input


def run_agent_turn(input_items, system_prompt):
    """Run one full agent turn (may involve multiple tool calls)."""
    while True:
        response = client.responses.create(
            model="gpt-5.1-codex-mini",
            max_output_tokens=4096,
            instructions=system_prompt,
            tools=TOOLS,
            input=clean_for_input(
                input_items
            ),  # strip output-only fields like 'status'
        )

        # Append everything the model emitted (text + tool calls) back into history.
        # Stored verbatim; cleaning happens at the API boundary above.
        input_items += serialize_output(response.output)

        # Find any tool calls the model wants us to run.
        tool_calls = [item for item in response.output if item.type == "function_call"]

        # If no tool calls, the model is done — extract its text and return.
        if not tool_calls:
            return response.output_text, input_items

        # Otherwise, execute each tool call and append its result.
        for call in tool_calls:
            args = json.loads(call.arguments)  # arguments is a JSON string, not a dict
            print(f"  Tool: {call.name}({json.dumps(args)})")
            result = execute_tool(call.name, args)

            input_items.append(
                {
                    "type": "function_call_output",
                    "call_id": call.call_id,
                    "output": str(result),
                }
            )
