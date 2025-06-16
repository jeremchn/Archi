import csv
import json

input_file = 'Architectural_and_design.csv'
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

with open(input_file, encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for i, row in enumerate(reader):
        if i >= 1000:
            break
        # Vérifie que toutes les colonnes sauf Tags sont complètes (non vides)
        if all(row[field].strip() for field in fields):
            entry = {field: row[field] for field in fields}
            data.append(entry)

with open(output_file, 'w', encoding='utf-8') as jsonfile:
    json.dump(data, jsonfile, ensure_ascii=False, indent=2)

print(f"Conversion terminée. {len(data)} entrées exportées dans {output_file}")