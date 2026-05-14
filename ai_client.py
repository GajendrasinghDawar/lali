import os

from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

client = AzureOpenAI(
    api_key=os.getenv("AZURE_API_KEY"),
    azure_endpoint="https://lasttry-openai-azure.cognitiveservices.azure.com",
    api_version="2025-04-01-preview",
)
