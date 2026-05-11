import os

from dotenv import load_dotenv
from openai import AzureOpenAI
from telegram import Update
from telegram.ext import Application, MessageHandler, filters

from contants import SOUL
from utils import append_to_session, load_session

load_dotenv()


client = AzureOpenAI(
    api_key=os.getenv("AZURE_API_KEY"),
    azure_endpoint="https://lasttry-openai-azure.cognitiveservices.azure.com",
    api_version="2025-04-01-preview",
)


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
        instructions=SOUL,
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
