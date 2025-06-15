import csv
import json

input_file = 'lithotechlabs.csv'
output_file = 'data.json'

fields = [
    "Company Name",
    "Domain",
    "Industry",
    "Location",
    "Headcount",
    "Linkedin",
    "Description",
    "Company Type"
]

data = []

# Nouveau lien direct Google Drive pour le fichier CSV
REMOTE_URL = 'https://drive.google.com/uc?export=download&id=1TpEPy9m_d2plDbx3PRV5oGxN7McTR0e4'

# Exemple d'utilisation :
# import requests
# r = requests.get(REMOTE_URL)
# with open('lithotechlabs.csv', 'wb') as f:
#     f.write(r.content)

with open(input_file, encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # Vérifie que toutes les colonnes sauf Tags sont complètes (non vides)
        if all(row[field].strip() for field in fields):
            entry = {field: row[field] for field in fields}
            data.append(entry)

with open(output_file, 'w', encoding='utf-8') as jsonfile:
    json.dump(data, jsonfile, ensure_ascii=False, indent=2)

print(f"Conversion terminée. {len(data)} entrées exportées dans {output_file}")