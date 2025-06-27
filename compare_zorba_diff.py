import ijson

zorba_file = 'zorba_test_embedded_2000 (1).json'
fixed_file = 'zorba_test_embedded_2000_fixed.json'

def stream_json_array(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        for obj in ijson.items(f, 'item'):
            yield obj

def get_all_keys(filename, max_items=1000):
    keys = set()
    for i, obj in enumerate(stream_json_array(filename)):
        keys.update(obj.keys())
        if i >= max_items:
            break
    return keys

# Résumé global
zorba_keys = get_all_keys(zorba_file)
fixed_keys = get_all_keys(fixed_file)
print(f"Clés dans zorba mais pas dans fixed : {zorba_keys - fixed_keys}")
print(f"Clés dans fixed mais pas dans zorba : {fixed_keys - zorba_keys}")

# Compter le nombre d'éléments
zorba_count = sum(1 for _ in stream_json_array(zorba_file))
fixed_count = sum(1 for _ in stream_json_array(fixed_file))
print(f"Nombre d'éléments : zorba={zorba_count}, fixed={fixed_count}")

# Différences par index (affiche max 10 différences)
diff_count = 0
zorba_iter = stream_json_array(zorba_file)
fixed_iter = stream_json_array(fixed_file)
for i, (z, f) in enumerate(zip(zorba_iter, fixed_iter)):
    diff = {}
    all_keys = set(z.keys()) | set(f.keys())
    for k in all_keys:
        if z.get(k) != f.get(k):
            diff[k] = {'zorba': z.get(k), 'fixed': f.get(k)}
    if diff:
        diff_count += 1
        if diff_count <= 10:
            print(f"--- Différence à l'index {i} ---")
            for k, v in diff.items():
                print(f"  {k}: zorba={v['zorba']} | fixed={v['fixed']}")
            print()
if diff_count > 10:
    print(f"... {diff_count-10} autres différences non affichées ...")
print(f'Comparaison terminée. Nombre total de différences trouvées : {diff_count}')