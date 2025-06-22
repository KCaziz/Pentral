import requests
import json
import urllib.parse
def enrich_report_with_cve(results_nested: list[list[dict]], nist_api_key: str = "939c9760-5aec-433f-a5b2-78e069208edd") -> list[list[dict]]:
    for group in results_nested:
        if not isinstance(group, list):
            continue

        for entry in group:
            if not isinstance(entry, dict):
                continue

            technologie = entry.get("technologie", "").strip()
            version = entry.get("version", "").strip()

            # 🔁 Harmonisation phase1/phase2 : gérer 'cpe' ou 'cpes'
            cpes = entry.get("cpes")

            if cpes is None and "cpe" in entry:
                cpe_val = entry.get("cpe", "").strip()
                cpes = [cpe_val] if cpe_val else []

            if not isinstance(cpes, list):
                cpes = [cpes] if cpes else []

            #  CPE absent ou non significatif → deviner
            if not cpes or all(c.strip().upper() in {"", "N/A", "—", "NON RENSEIGNE", "NON_RENSEIGNE"} for c in cpes):
                cpes = guess_and_validate_cpe(technologie, version, api_key=nist_api_key)
                cpes = list(set(c.strip() for c in cpes if c.strip()))
            #  Stockage harmonisé pour le reste de la chaîne
            entry["cpes"] = cpes

            if not cpes:
                print(f"[INFO] ❌ Aucun CPE valide pour {technologie} {version}")
                entry.update({
                    "vulnerable": False,
                    "cve": "—",
                    "criticite": "Basse",
                    "description": "—"
                })
                continue

            print(f"[INFO] 🔍 Enrichissement des CVE pour {technologie} {version} avec {len(cpes)} CPE(s)...")
            cve_info = {}
            criticite = "Basse"

            for cpe in cpes:
                cpe23 = convert_to_cpe23(cpe)
                if not cpe23:
                    continue
                try:
                    print(f"[REQ] 📡 Requête NVD pour CPE : {cpe23}")
                    base_url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
                    params = {"cpeName": cpe23, "resultsPerPage": 100}
                    headers = {"apiKey": nist_api_key} if nist_api_key else {}
                    response = requests.get(base_url, params=params, headers=headers)
                    response.raise_for_status()
                    data = response.json()
                    vulnerabilities = data.get("vulnerabilities", [])

                    for vuln in vulnerabilities:
                        cve_id = vuln.get("cve", {}).get("id")
                        if not cve_id:
                            continue
                        severity = "UNKNOWN"
                        metrics = vuln.get("cve", {}).get("metrics", {})
                        for key in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
                            if key in metrics:
                                severity = metrics[key][0].get("cvssData", {}).get("baseSeverity", "UNKNOWN")
                                break
                        
                        # Récupération de la description
                        description = "—"
                        descriptions = vuln.get("cve", {}).get("descriptions", [])
                        for desc in descriptions:
                            if desc.get("lang") == "en":
                                description = desc.get("value", "—")
                                break
                        
                        cve_info[cve_id] = {"severity": severity, "description": description}

                        if severity in ["CRITICAL", "HIGH"]:
                            criticite = "Haute"
                        elif severity == "MEDIUM" and criticite != "Haute":
                            criticite = "Moyenne"
                    time.sleep(1)

                except Exception as e:
                    print(f"[ERREUR] ❌ Erreur API NVD pour {cpe23}: {e}")
                    continue

            if cve_info:
                severite_order = {"CRITICAL": 3, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "UNKNOWN": 0}
                cve_tri = sorted(cve_info.items(), key=lambda x: severite_order.get(x[1]["severity"], 0), reverse=True)
                top_3 = cve_tri[:3]
                
                cve_list = [cve for cve, _ in top_3]
                description_list = [info["description"] for _, info in top_3]
                
                print(f"[RESULT] ✅ CVEs sélectionnées pour {technologie} : {', '.join(cve_list)}")
                entry.update({
                    "vulnerable": True,
                    "cve": ", ".join(cve_list),
                    "criticite": criticite,
                    "description": " | ".join(description_list)
                })
            else:
                print(f"[RESULT] 🚫 Aucune CVE pertinente trouvée pour {technologie}")
                entry.update({
                    "vulnerable": False,
                    "cve": "—",
                    "criticite": "Basse",
                    "description": "—"
                })

    return results_nested

def get_cpe_details(cpe_name):
    base_url = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    params = {
        'cpeName': cpe_name,
        'resultsPerPage': 100
    }
    
    headers = {
        "apiKey": "939c9760-5aec-433f-a5b2-78e069208edd"
    }
    
    try:
        response = requests.get(base_url, params=params, headers=headers)
        response.raise_for_status()
        
        data = response.json()

        with open(f"cpe_{cpe_name.replace(':', '_')}.json", 'w') as f:
            json.dump(data, f, indent=4)
            
        print(f"Données sauvegardées pour {cpe_name}")
        print(f"Total de résultats: {data.get('totalResults', 0)}")
        vulnerabilities = data.get("vulnerabilities", [])

        for vuln in vulnerabilities:
            metrics = vuln.get("cve", {}).get("descriptions", {})

            print("data", metrics.get("value", {}))
        
        return data
        
    except requests.exceptions.RequestException as e:
        print(f"Erreur lors de la requête: {e}")
        print("Statut HTTP :", response.status_code if 'response' in locals() else 'inconnu')
        return None

# Exemple d'utilisation
cpe_example = "cpe:2.3:o:microsoft:windows_10_1607:-:*:*:*:*:*:x86:*"
get_cpe_details(cpe_example)
