import os
import threading
from collections import defaultdict

from flask import Flask, jsonify, request
from telegram import Update
from telegram.ext import Application, MessageHandler, filters

from agent import run_agent_turn
from compaction import compact_session
from contants import SOUL
from schedular import setup_heartbeats
from utils import (
    append_to_session,
    load_session,
    save_session,
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

setup_heartbeats()
app.run_polling()
