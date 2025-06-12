import json
import openai
import time
import os
from dotenv import load_dotenv

# Charger la clé API depuis .env
load_dotenv()
openai.api_key = os.getenv("OPENAIKEY")

def build_text(company):
    fields = [
        company.get("Company Name", ""),
        company.get("Domain", ""),
        company.get("Industry", ""),
        company.get("Location", ""),
        company.get("Headcount", ""),
        company.get("Linkedin", ""),
        company.get("Description", ""),
        company.get("Company Type", "")
    ]
    return " | ".join(fields)

with open("data2000.json", "r", encoding="utf-8") as f:
    companies = json.load(f)

embedded = []
total = len(companies)
for i, company in enumerate(companies):
    text = build_text(company)
    try:
        response = openai.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        embedding = response.data[0].embedding
        company["embedding"] = embedding
        embedded.append(company)
        print(f"{i+1}/{total}")
        time.sleep(0.5)
    except Exception as e:
        print(f"Erreur à l'index {i}: {e}")
        continue

with open("data2000_embedded.json", "w", encoding="utf-8") as f:
    json.dump(embedded, f, ensure_ascii=False, indent=2)