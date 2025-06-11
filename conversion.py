import numpy as np
import json

embeddings = np.load('embeddings100.npy')
with open('embeddings100.json', 'w', encoding='utf-8') as f:
    json.dump(embeddings.tolist(), f)
print("Conversion terminée !")