import json
import os

from dotenv import load_dotenv
from openai import AzureOpenAI
from telegram import Update
from telegram.ext import Application, MessageHandler, filters

load_dotenv()


client = AzureOpenAI(
    api_key=os.getenv("AZURE_API_KEY"),
    azure_endpoint="https://lasttry-openai-azure.cognitiveservices.azure.com",
    api_version="2025-04-01-preview",
)

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


async def handle_message(update: Update, context):

    if update.message is None or update.message.text is None:
        return
    user_message = update.message.text

    if (
        update.message is None
        or update.message.text is None
        or update.effective_user is None
    ):
        return

    user_id = str(update.effective_user.id)

    messages = load_session(user_id)

    user_msg = {"role": "user", "content": user_message}
    messages.append(user_msg)
    append_to_session(user_id, user_msg)

    response = client.responses.create(
        model="gpt-5.1-codex-mini",
        instructions="You are a coding assistant that talks like a pirate.",
        input=messages,
        max_output_tokens=4000,
    )
    # save assistant response
    assistant_msg = {"role": "assistant", "content": response.output_text}
    append_to_session(user_id, assistant_msg)

    await update.message.reply_text(response.output_text)


TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TELEGRAM_BOT_TOKEN:
    raise RuntimeError("telegram token is not set in env")


app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

app.run_polling()
