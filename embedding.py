import csv
import json
import openai
import time
import os
from dotenv import load_dotenv

# Charger la clé API depuis .env
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAIKEY")
if not api_key:
    raise ValueError("Aucune clé API OpenAI trouvée. Ajoutez OPENAI_API_KEY ou OPENAIKEY dans votre .env.")
openai.api_key = api_key

# Fonction pour construire le texte à embedder

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

# Lire les 1000 premières lignes du CSV (hors header)
companies = []
with open("jeuxvidéos.csv", "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader):
        if i >= 1000:
            break
        companies.append(row)

# Reprise : charger les embeddings déjà calculés si le fichier existe
embedded = []
start_index = 0
if os.path.exists("jeuxvidéos_embedded.json"):
    with open("jeuxvidéos_embedded.json", "r", encoding="utf-8") as f:
        embedded = json.load(f)
    start_index = len(embedded)
    print(f"Reprise à l'index {start_index} (déjà {start_index} embeddings calculés)")

total = len(companies)
for i, company in enumerate(companies[start_index:], start=start_index):
    # Harmoniser les clés pour correspondre au format cible
    company = {
        "Company Name": company.get("Company Name", ""),
        "Domain": company.get("Domain", ""),
        "Industry": company.get("Industry", ""),
        "Location": company.get("Location", ""),
        "Headcount": company.get("Headcount", ""),
        "Linkedin": company.get("Linkedin", ""),
        "Description": company.get("Description", ""),
        "Company Type": company.get("Company Type", ""),
        "Tags": company.get("Tags", "")
    }
    text = build_text(company)
    # S'assurer que la clé API est toujours présente
    openai.api_key = api_key
    try:
        response = openai.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        embedding = response.data[0].embedding
        company["embedding"] = embedding
        embedded.append(company)
        print(f"{i+1}/{total}")
        # Sauvegarde intermédiaire pour reprise facile
        if (i+1) % 10 == 0 or (i+1) == total:
            with open("jeuxvidéos_embedded.json", "w", encoding="utf-8") as f:
                json.dump(embedded, f, ensure_ascii=False, indent=2)
        time.sleep(0.5)
    except Exception as e:
        print(f"Erreur à l'index {i}: {e}")
        continue

# Sauvegarde finale
with open("jeuxvidéos_embedded.json", "w", encoding="utf-8") as f:
    json.dump(embedded, f, ensure_ascii=False, indent=2)