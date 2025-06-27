import json

# Chemin du fichier source et du fichier de sortie
input_file = "zorba_test_embedded.json"
output_file = "zorba_test_embedded_2000.json"

# Lecture du fichier JSON
with open(input_file, "r", encoding="utf-8") as f:
    data = json.load(f)

# Garde les 2000 premiers éléments
data_2000 = data[:2000]

# Sauvegarde dans un nouveau fichier
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(data_2000, f, ensure_ascii=False, indent=2)

print(f"Fichier créé : {output_file} ({len(data_2000)} entreprises)")