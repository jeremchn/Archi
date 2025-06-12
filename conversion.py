import json

# Charger les données depuis data.json
with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Définir les champs obligatoires (tous sauf Tags)
required_fields = [
    "Company Name",
    "Domain",
    "Industry",
    "Location",
    "Headcount",
    "Linkedin",
    "Description",
    "Company Type"
]

# Filtrer les entreprises valides
filtered = []
for company in data:
    if all(company.get(field, "").strip() != "" for field in required_fields):
        filtered.append(company)
    if len(filtered) == 2000:
        break

# Sauvegarder dans data2000.json
with open('data2000.json', 'w', encoding='utf-8') as f:
    json.dump(filtered, f, ensure_ascii=False, indent=2)

print(f"{len(filtered)} entreprises sauvegardées dans data2000.json")