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


async def handle_message(update: Update, context):
    if update.message is None or update.message.text is None:
        return
    user_message = update.message.text

    response = client.responses.create(
        model="gpt-5.1-codex-mini",
        instructions="You are a coding assistant that talks like a pirate.",
        input=user_message,
        max_output_tokens=100,
    )
    await update.message.reply_text(response.output_text)


TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TELEGRAM_BOT_TOKEN:
    raise RuntimeError("telegram token is not set in env")


app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

app.run_polling()
