import json
import os
import threading
from collections import defaultdict

from flask import Flask, jsonify, request
from telegram import Update
from telegram.ext import Application, MessageHandler, filters

from ai_client import client
from compaction import compact_session
from contants import SOUL
from tools import TOOLS, execute_tool, serialize_output
from utils import (
    append_to_session,
    clean_for_input,
    load_session,
    save_session,
)


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


session_locks = defaultdict(threading.Lock)


async def handle_message(update: Update, context):
    if (
        update.message is None
        or update.message.text is None
        or update.effective_user is None
    ):
        return

    user_id = str(update.effective_user.id)
    with session_locks[user_id]:
        user_message = update.message.text

        messages = load_session(user_id)
        messages = compact_session(user_id, messages)

        user_msg = {"role": "user", "content": user_message}
        messages.append(user_msg)
        append_to_session(user_id, user_msg)

        response_text, messages = run_agent_turn(messages, SOUL)

        save_session(user_id, messages)
    await update.message.reply_text(response_text)


flask_app = Flask(__name__)


@flask_app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_id = data["user_id"]
    with session_locks[user_id]:
        messages = load_session(user_id)
        messages = compact_session(user_id, messages)
        messages.append({"role": "user", "content": data["message"]})

        response_text, messages = run_agent_turn(messages, SOUL)

        save_session(user_id, messages)
    return jsonify({"response": response_text})


threading.Thread(target=lambda: flask_app.run(port=5000), daemon=True).start()


TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TELEGRAM_BOT_TOKEN:
    raise RuntimeError("telegram token is not set in env")


app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
app.run_polling()
