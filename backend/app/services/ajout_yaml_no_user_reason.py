import requests 
import subprocess
import re
import argparse
import yaml 
import time
import json

def send_pause_request(command):
    """Envoie une requête au backend pour informer qu'on attend une réponse."""
    response = requests.post("http://127.0.0.1:5000/pause", json={'command': command})
    return response.json()

def get_user_response():
    """Attend que le backend fournisse une réponse."""
    while True:
        response = requests.get("http://127.0.0.1:5000/get_response")
        data = response.json()
        if data["status"] == "ready" and data["user_response"] is not None:
            return data["user_response"], data["user_command"]
        time.sleep(1)  # Attendre 1 seconde avant de réessayer
        
def send_validation(command, is_valid):
    """Envoie une requête au backend pour informer qu'on attend une validation."""
    response = requests.post("http://127.0.0.1:5000/validation", json={'command': command, 'is_valid' : is_valid})
    return response.json()

def get_user_validation():
    """Attend que le backend fournisse une réponse."""
    while True:
        response = requests.get("http://127.0.0.1:5000/get_response")
        data = response.json()
        print("Réponse script : ", data["user_response"])
        if data["status"] == "ready" and data["user_response"] is not None:
            return data["user_response"], data["user_command"]
        time.sleep(1)  # Attendre 1 seconde avant de réessayer

def send_command(command):
    """Envoie une commande au backend ."""
    response = requests.post("http://127.0.0.1:5000/send_command", json={'command': command})
    return response.json()

def get_unpause():
    """Envoie une requête au backend pour informer qu'on attend une réponse."""
    while True :
        response = requests.get("http://127.0.0.1:5000/unpause")
        data = response.json()
        print("Réponse script : ", data["status"])
        if data["status"] == "ready" :
            return
        time.sleep(1)
    
        
# Fonction pour valider la cible
def validate_target(target):
    """
    Valide la cible entrée par l'utilisateur.
    Retourne True si la cible est valide, sinon False.
    """
    # Vérifie si c'est une adresse IP unique
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", target):
        return True

    # Vérifie si c'est une plage d'IP CIDR (ex. 192.168.1.0/24)
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$", target):
        return True

    # Vérifie si c'est une plage d'IP avec intervalle (ex. 192.168.1.1-10)
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{1,3}$", target):
        return True

    # Vérifie si c'est un domaine (ex. example.com)
    if re.match(r"^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", target):
        return True

    # Vérifie si c'est un site web (ex. http://example.com ou https://example.com)
    if re.match(r"^(http|https)://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$", target):
        return True

    # Si aucune condition n'est satisfaite, la cible est invalide
    return False

def query_mistral(prompt, api_url="http://host.docker.internal:8080/v1/chat/completions"):
    """
    Fonction qui utilise le mode stream=True pour interagir avec llama.cpp
    et retourne le texte généré en temps réel.
    """
    try:
        payload = {
            "model": "mistral",
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "stream": True,
            "temperature": 0.9,
            "top_p": 0.9
        }

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        response = requests.post(api_url, json=payload, headers=headers, stream=True)
        response.raise_for_status()

        full_response = ""
        for line in response.iter_lines():
            if not line:
                continue

            decoded_line = line.decode("utf-8").strip()

            if decoded_line.startswith("data:"):
                decoded_line = decoded_line[len("data:"):].strip()

            if decoded_line == "[DONE]":
                break

            try:
                json_data = json.loads(decoded_line)

                content_piece = json_data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                print(content_piece, end='', flush=True)
                full_response += content_piece

                if "reasoning" in json_data:
                    reasoning = json_data["reasoning"]
                    print(f"\n[RAISONNEMENT] {reasoning}")

            except json.JSONDecodeError:
                print(f"[ERREUR] Ligne non JSON : {decoded_line}")
                continue

        print("\n")  # saut de ligne
        return full_response.strip()

    except requests.RequestException as e:
        print(f"[ERREUR HTTP] : {e}")
        return None
    except Exception as e:
        print(f"[ERREUR] : {e}")
        return None


# def query_mistral(prompt, api_url="http://localhost:8080/v1/chat/completions"):
#     """
#     Envoie une requête HTTP POST à l'API Ollama et récupère la réponse de Mistral.
#     """
#     try:
#         # Prépare la requête JSON
#         payload = {
#             "model": "mistral",  # Spécifie le modèle à utiliser
#             "prompt": prompt,
#             "stream": False,  # Désactive le streaming pour une réponse complète
#             "temperature": 0.9,  # Contrôle la créativité (0 = plus déterministe, 1 = plus aléatoire)
#             "top_p": 0.9,  # Filtrage probabiliste des tokens
#             "max_tokens": 150  # Limite la longueur de la sortie
#         }

#         # Envoie la requête HTTP POST
#         response = requests.post(api_url, json=payload, headers={"Content-Type": "application/json"})

#         # Vérifie le statut de la réponse
#         if response.status_code != 200:
#             print(f"[DEBUG] Code de statut HTTP non valide : {response.status_code}")
#             print(f"[DEBUG] Message d'erreur : {response.text.strip()}")
#             return None

#         # Récupère la réponse JSON
#         data = response.json()
#         mistral_response = data.get("response", "").strip()

#         #print(f"[DEBUG] Réponse brute de Mistral : {mistral_response}")
#         return mistral_response
#     except requests.exceptions.RequestException as e:
#         print(f"[DEBUG] Erreur lors de la communication avec l'API Ollama : {e}")
#         return None 
#     except Exception as e:
#         print(f"[DEBUG] Erreur générale : {e}")
#         return None


def clean_command(command):
    """
    Nettoie une commande en supprimant les caractères inutiles comme les antislashs et les espaces.
    """
    return command.replace("\\", "").strip()

# Fonction pour extraire les commandes
def extract_commands(response):
    """
    Extrait le nom de l'outil, la commande d'énumération et la commande d'installation depuis une réponse YAML.
    Gère les espaces inutiles, les triples backticks, les commentaires et les champs manquants.
    Retourne un dictionnaire contenant ces trois éléments.
    """
    try:
        # Étape 1 : Suppression des triples backticks (si présents)
        if response.startswith("```") and response.endswith("```"):
            response = response[3:-3].strip()

        # Étape 2 : Nettoyage ligne par ligne pour corriger l'indentation et filtrer les lignes invalides
        lines = response.splitlines()
        cleaned_lines = []
        for line in lines:
            line = line.strip()  # Supprime les espaces inutiles
            if line and ":" in line:  # Garde uniquement les lignes contenant des clés YAML valides
                cleaned_lines.append(line)
        cleaned_response = "\n".join(cleaned_lines)

        # Étape 3 : Analyse de la réponse YAML
        data = yaml.safe_load(cleaned_response)

        # Étape 4 : Extraction des champs avec gestion des cas spéciaux
        tool_name = data.get("tool_name", "").strip()
        enumerate_command = data.get("enumerate_command", "").strip()
        install_command = data.get("install_command", "").strip()

        # Validation des champs obligatoires
        if not tool_name:
            print("[DEBUG] Le champ 'tool_name' est manquant ou vide.")
            return None
        if not enumerate_command:
            print("[DEBUG] Le champ 'enumerate_command' est manquant ou vide.")
            return None

        # Gestion des commentaires ou champs vides dans install_command
        if not install_command or install_command.startswith("#"):
            install_command = None  # Remplace les commentaires ou champs vides par None

        # Nettoyage des commandes
        enumerate_command = clean_command(enumerate_command)
        install_command = clean_command(install_command) if install_command else None

        # Retourne un dictionnaire avec les informations extraites
        return {
            "tool_name": tool_name,
            "enumerate": enumerate_command,
            "install": install_command
        }

    except yaml.YAMLError as e:
        print(f"[DEBUG] Erreur lors de l'analyse YAML : {e}")
        return None
    except Exception as e:
        print(f"[DEBUG] Erreur inattendue lors de l'extraction des commandes : {e}")
        return None
    
#extrait les rép concernant la val de la cmd du user
def extract_validation(response):
    try:
        # Étape 1 : Nettoyage initial
        response = response.strip()
        
        # Étape 2 : Suppression des backticks et markdown
        if response.startswith("```") and response.endswith("```"):
            response = response[3:-3].strip()
            # Supprime aussi le 'yaml' après les backticks ouverts si présent
            if response.startswith("yaml"):
                response = response[4:].strip()

        # Étape 3 : Suppression des lignes vides et commentaires
        lines = []
        for line in response.splitlines():
            line = line.rstrip()  # Garde l'indentation mais supprime espaces de fin
            if line and not line.lstrip().startswith("#"):
                lines.append(line)
        cleaned_response = "\n".join(lines)

        print(f"[DEBUG RAW YAML]\n{cleaned_response}")  # Debug crucial

        # Étape 4 : Validation YAML stricte
        data = yaml.safe_load(cleaned_response)
        if not isinstance(data, dict):
            raise ValueError("Le YAML ne contient pas de dictionnaire valide")

        # Étape 5 : Extraction avec vérification
        required_fields = {'is_valid': (bool, type(None)), 'reason': str}
        for field, types in required_fields.items():
            if field not in data:
                raise KeyError(f"Champ requis manquant: {field}")
            if not isinstance(data[field], types):
                raise TypeError(f"Type invalide pour {field}: {type(data[field])}")

        return {
            "is_valid": bool(data["is_valid"]),
            "reason": str(data["reason"]).strip()
        }

    except Exception as e:
        print(f"[ERROR] Erreur lors de l'extraction:\n{type(e).__name__}: {e}\nInput:\n{response}")
        return {
            "is_valid": None,
            "reason": f"Erreur de traitement: {type(e).__name__} - {str(e)}"
        }

# Fonction pour exécuter une commande dans le conteneur
def execute_command_docker(command, container_name="pentest-env"):
    """
    Exécute une commande Linux dans un conteneur Docker.
    Retire automatiquement 'sudo' car nous sommes en tant que root.
    """
    try:
        full_command = command.replace("sudo ", "", 1)  # Retire 'sudo' si présent
        full_command = full_command.replace("`", "").strip()  # Supprime les backticks et les espaces inutiles
        print(f"[DEBUG] Commande complète à exécuter : {full_command}")

        # Exécute la commande dans le conteneur
        result = subprocess.run(
            [full_command],
            capture_output=True,
            shell=True,
            text=True
        )

        # Affiche le résultat brut pour le debug
        print("Résultat :")
        print(result.stdout)

        # Affiche les erreurs si elles existent
        if result.stderr:
            print(f"[DEBUG] Erreur lors de l'exécution : {result.stderr.strip()}")
            return result.stderr.strip()
        #vérifie si la cmnd a réussi
        if result.returncode != 0 :
            print(f"([DEBUG]La commande '{command}'a échoué avec le code {result.returncode}.")
            return False
        
        return result.stdout  # Retourne les résultats de la commande
    except Exception as e:
        print(f"[DEBUG] Erreur générale lors de l'exécution : {e}")
        return False
    
def analyze_result_with_mistral(raw_result, target, enumerate_command):
    """
    Envoie le résultat brut à Mistral pour analyse et extraction des informations essentielles.
    Ajoute également la commande d'énumération exécutée au contexte pour une meilleure analyse.
    """
    try:
        # Construis le prompt pour demander à Mistral d'analyser le résultat
        prompt = f"""
        Vous êtes un expert en tests de pénétration. Voici le contexte :
        - Cible : {target}
        - Commande d'énumération exécutée : {enumerate_command}
        - Résultat brut de la commande :

        ```
        {raw_result}
        ```

        Analysez ce résultat et extrayez uniquement les informations essentielles sous **format YAML**.  
        Respectez **strictement** cette structure :  

        ```yaml
        tool_name: <nom_de_l_outil>
        command_executed: <commande_exécutée>
        analysis:
        - <info_clé_1>
        - <info_clé_2>
        - <info_clé_3>
        - ...

        ## Contraintes :
        - Inclure toutes les informations pertinentes extraites du résultat.
        - Ne pas proposer d'étapes supplémentaires, seulement une analyse factuelle.
        - Ne pas donner d'explications en dehors du YAML.
        - Respecter le format YAML strictement, sans texte en dehors du bloc YAML.
        """
        # Interroge Mistral pour analyser le résultat
        response = query_mistral(prompt)
        if not response:
            print("[DEBUG] Impossible de communiquer avec Mistral pour analyser le résultat.")
            return None

        #print(f"[DEBUG] Analyse de Mistral : {response}")
        return response.strip()  # Retourne l'analyse nettoyée

    except Exception as e:
        print(f"[DEBUG] Erreur lors de l'analyse du résultat avec Mistral : {e}")
        return None


def extract_install_command(response):
    """
    Extrait la commande d'installation depuis une réponse YAML.
    Gère les espaces inutiles, les triples backticks, et les problèmes d'indentation.
    Retourne la commande d'installation si elle est trouvée, sinon None.
    """
    try:
        # Étape 1 : Suppression des triples backticks (si présents)
        if response.startswith("```") and response.endswith("```"):
            response = response[3:-3].strip()

        # Étape 2 : Nettoyage de chaque ligne pour corriger l'indentation
        lines = response.splitlines()
        cleaned_lines = []
        for line in lines:
            line = line.strip()  # Supprime les espaces inutiles
            if line and ":" in line:  # Garde uniquement les lignes contenant des clés YAML valides
                cleaned_lines.append(line)
        cleaned_response = "\n".join(cleaned_lines)

        # Étape 3 : Analyse de la réponse YAML
        data = yaml.safe_load(cleaned_response)

        # Extraction de la commande d'installation
        install_command = clean_command(data.get("install_command", "").strip())

        # Affiche la commande d'installation pour le débogage
        print(f"[DEBUG] Commande d'installation extraite : {install_command}")

        # Retourne la commande d'installation si elle est valide
        return install_command if install_command else None

    except yaml.YAMLError as e:
        print(f"[DEBUG] Erreur lors de l'analyse YAML : {e}")
        return None
    except Exception as e:
        print(f"[DEBUG] Erreur inattendue lors de l'extraction de la commande d'installation : {e}")
        return None
    
def extract_tool_from_command(command):
    """
    Extrait le nom de l'outil depuis une commande utilisateur.

    """
    if not command:
        return ""
    # Sépare la commande par des espaces et retourne le premier mot
    return command.split()[0].strip()

def check_and_install_tool(tool_name, install_command=None, container_name="pentest-env"):
    """
    Vérifie si un outil est installé dans le conteneur Docker.
    Si l'outil n'est pas installé, tente de l'installer via apt, pip, gem, ou utilise la commande fournie.
    Si aucune méthode ne fonctionne et qu'aucune commande n'est fournie, demande à Mistral une méthode d'installation.
    Retourne True si l'installation réussit, sinon False.
    """
    try:
        # Étape 1 : Vérifie si l'outil est déjà installé avec la commande 'which'
        check_command = f"which {tool_name}"
        result = subprocess.run(
            [check_command],
            capture_output=True,
            shell=True,
            text=True
        )
        if result.returncode == 0:
            print(f"[INFO] L'outil '{tool_name}' est déjà installé.")
            return True

        # Étape 2 : Tente d'installer l'outil via apt, pip, ou gem
        for method in ["apt", "pip", "gem"]:
            install_attempt = None
            if method == "apt":
                install_attempt = f"apt-get update && apt-get install -y {tool_name}"
            elif method == "pip":
                install_attempt = f"pip3 install {tool_name}"
            elif method == "gem":
                install_attempt = f"gem install {tool_name}"

            print(f"[INFO] Tentative d'installation de l'outil '{tool_name}' via {method}...")
            install_result = subprocess.run(
                [install_attempt],
                capture_output=True,
                shell=True,
                text=True
            )

            if install_result.returncode == 0:
                print(f"[INFO] L'outil '{tool_name}' a été installé avec succès via {method}.")
                return True

        # Étape 3 : Si une commande d'installation est fournie par Mistral (ou l'utilisateur(jsp si c interessant de dmnder au user de la donner idk)), utilisez-la
        if install_command:
            print(f"[INFO] Installation de l'outil '{tool_name}' via la commande fournie : {install_command}")
            install_result = subprocess.run(
                [install_command],
                capture_output=True,
                shell=True,
                text=True
            )

            if install_result.returncode == 0:
                print(f"[INFO] L'outil '{tool_name}' a été installé avec succès via la commande fournie.")
                return True
            else:
                print(f"[ERREUR] Échec de l'installation de l'outil '{tool_name}' via la commande fournie.")
                return False
            
        if not install_command :
            # Étape 4 : Si aucune méthode ne fonctionne et qu'aucune commande n'est fournie, demandez à Mistral
            print(f"[INFO] L'outil '{tool_name}' n'est pas disponible via apt, pip, ou gem. Demande à Mistral...")
            prompt = f"""
            -Génère la commande d'installation pour l'outil '{tool_name}' sur Kali Linux."
            -Retourne la commande d'installation sous forme de fichier YAML bien structuré, avec le format suivant :
            ```yaml
            install_command: <cmd_install>
            -**Respecte STRICTEMENT ce format. N'ajoute aucun texte supplémentaire**.
            """
            mistral_response = query_mistral(prompt)
            if not mistral_response:
                print(f"[ERREUR] Impossible d'obtenir une méthode d'installation pour l'outil '{tool_name}'.")
                return False

        # Extrait la commande d'installation depuis la réponse de Mistral
        extracted_install_command = extract_install_command(mistral_response)
        if not extracted_install_command:
            print(f"[ERREUR] La réponse de Mistral ne contient pas de commande valide pour installer '{tool_name}'.")
            return False

        print(f"[INFO] Installation de l'outil '{tool_name}' via Mistral : {extracted_install_command}")
        install_result = subprocess.run(
            [extracted_install_command],
            capture_output=True,
            shell=True,
            text=True
        )

        if install_result.returncode != 0:
            print(f"[ERREUR] Échec de l'installation de l'outil '{tool_name}' via Mistral.")
            return False

        print(f"[INFO] L'outil '{tool_name}' a été installé avec succès via Mistral.")
        return True

    except Exception as e:
        print(f"[DEBUG] Erreur lors de la vérification ou de l'installation de l'outil : {e}")
        return False


# Fonction principale
def main(target):
    print("=== Générateur de Commandes d'Énumération ===")


    print(target)

    if validate_target(target):
        print("target valide") 
    else:
        print("Erreur : La cible entrée n'est pas valide. Veuillez entrer une adresse IP, une plage d'IP, un domaine ou un site web.")

    # Initialisation des variables pour stocker l'historique
    history = []  # Liste pour stocker les commandes et leurs résultats

    prompt_initial = f"""
    <s>[INST]
    ### 🎯 Objectif :
    Vous êtes un générateur automatique de commandes shell pour l’énumération réseau dans le cadre d’un test de pénétration sur Kali Linux.

    Votre mission est de générer **une seule commande précise, utile et exécutable**, qui permet de **collecter des informations techniques exploitables** sur la cible indiquée.

    ---

    ### ⚙️ Contexte d’exécution :
    - Cible analysée : {target}
    - Environnement : Kali Linux (terminal uniquement)
    - Exécution dans un conteneur Docker (pas de `sudo`)
    - La sortie de la commande sera capturée automatiquement (stdout uniquement)
    - Aucun accès à des fichiers intermédiaires, journaux, interfaces graphiques ou navigateurs

    ---

    ### 📋 Contraintes techniques strictes :
    1. ✅ La commande doit être **strictement valide** sur Kali Linux.
    2. ✅ Tous les outils utilisés doivent être **connus et maintenus**.  
    ❌ **N’inventez jamais d’outil.** Par exemple, `sslyard`, `my-scan` ou tout nom douteux est interdit.
    3. ✅ L’installation doit se faire via `apt` ou `pip` uniquement.  
    ❌ Interdiction d’utiliser `git clone`, `curl`, `make`, ou des dépôts GitHub.
    4. ❌ Aucune commande de **bruteforce**, fuzzing, DoS, ni tentative de connexion agressive.
    5. ❌ Aucune **redirection de sortie** vers un fichier (`>`, `-oN`, `-oX`, `-oG`, etc.).
    6. ✅ La commande doit renvoyer un **résultat directement affiché dans le terminal** (stdout uniquement).
    7. ❌ Ne répétez jamais un port dans une même commande (ex : `-p 80,443,80` est invalide).
    8. ❌ Ne proposez jamais de **scan complet** (`-p-`, `-p 1-65535`, etc.).  
    ✅ Limitez-vous à une liste raisonnable de ports : 21, 22, 25, 53, 80, 110, 139, 143, 443, 3306, 8080…
    9. ❌ La commande ne doit utiliser **qu’un seul outil** (pas de pipelines ou combinaisons).
    10. ⏱️ La commande doit s’exécuter **en moins de 15 secondes** sur une machine standard.
    11. ❌ Aucun commentaire, texte explicatif, justification ou remarque **hors du bloc YAML**.
    12. ✅ Le champ `constraints_respected` doit toujours être défini à `true` si toutes les contraintes sont respectées.

    ---

    ### 📦 Format OBLIGATOIRE de la réponse :
    ```yaml
    tool_name: <nom_de_l_outil>
    enumerate_command: <commande à exécuter>
    install_command: <commande d'installation>
    constraints_respected: true

    ---

    ### 📊 Exemples d’informations exploitables attendues :
    - Services ouverts et versions (ex : SSH 7.9p1, Apache 2.4.41)
    - Bannières d’identification ou messages de bienvenue
    - Protocoles et options activées (ex : SSL/TLS, HTTP headers, DNS records)
    - Configurations visibles (authentification, nom d’hôte, partages, etc.)
    - Topologie ou noms de domaines internes


    ---
    ### 🛡️ Règles supplémentaires si vous proposez `--script` avec Nmap :
    - ✅ Utilisez uniquement des scripts réellement présents dans `/usr/share/nmap/scripts/` sur Kali Linux.
    - ❌ N’inventez jamais de nom de script (ex : `vuln-sql` est interdit).
    - ❌ Ne proposez pas `--script` si vous n’êtes pas absolument certain de la validité de tous les scripts utilisés.

    ---

    ### 🛑 Important :
    - La commande doit fournir des **informations techniques précises et utiles** : services ouverts, versions, bannières, protocoles, configurations…
    - ❌ Ne proposez pas d’outils trop basiques ou sans valeur ajoutée en pentest : `ping`, `traceroute`, etc.
    - ❌ N'inventez rien. Aucune option, outil ou script non existant ou non vérifiable.
    - ❌ Ne proposez rien si les contraintes ci-dessus ne peuvent pas être respectées.
    ---

    Générez maintenant une **commande d’énumération réseau fiable, rapide et exploitable** pour la cible suivante :

    👉 **Cible** : {target}

    [/INST]</s>

    """  

    phase2=False
    # Interroge Mistral avec le prompt initial
    response = query_mistral(prompt_initial)
    while not phase2:
        if not response:
            print("Impossible de communiquer avec Mistral ou réponse invalide.")
            exit()
   
    
        # Extraire les commandes
        commands = extract_commands(response)
        if not commands:
            print("Impossible d'extraire les informations depuis la réponse YAML de Mistral.Passer à la prochaine itération")
            break
    
    
        tool_name = commands.get("tool_name")
        enumerate_command = commands.get("enumerate")
        install_command = commands.get("install")
        
        print(f"Nom de l'outil : {tool_name}")
        print(f"Commande d'énumération extraite : {enumerate_command}")
        print(f"Commande d'installation extraite : {install_command}")

    
    
        # Demander confirmation à l'utilisateur
        print(f">>> {enumerate_command}")
        send_command(enumerate_command)  
        # user_confirmation = input("Voulez-vous utiliser cette commande ? (o/n) : ").strip().lower()
        user_confirmation = 'o'  
        get_unpause()
        
        # send_pause_request(enumerate_command)  # Envoie une requête pour indiquer que l'on attend une réponse
        # print("En attente de confirmation de l'utilisateur...")

        # # Attendre la réponse du frontend
        # user_confirmation, user_alternative = get_user_response()
        
        # print(f"Réponse reçue : {user_confirmation}")
        # print(f"Commande alternative reçue : {user_alternative}")

        if user_confirmation == 'o':
            # L'utilisateur confirme, on garde la commande initiale
            print("La commande d'énumération a été confirmée.")
            
            
        elif user_confirmation == 'n':  # L'utilisateur refuse, proposer une alternative            
            if user_alternative:
                print("Remplacement de la commande d'énumération par celle de l'utilisateur...")
                
                # Étape 1 : Envoyer la commande alternative à Mistral pour validation
                prompt_for_validation = (
                    f"Contexte :\n"
                    f"- Cible : {target}\n"
                    f"- Historique des commandes exécutées :\n"
                )
                for entry in history:
                    prompt_for_validation += f"  - Commande : {entry['command']}, Résultat : {entry['result']}\n"
                prompt_for_validation += (
                    f"\nL'utilisateur propose la commande suivante : {user_alternative}\n"
                    f"Est-ce une commande pertinente et optimale pour le test de pénétration ?\n"
                    f"Répondez STRICTEMENT dans le format YAML suivant :"
                    f"```yaml"
                    f"is_valid: bool (True si la commande est valide, False sinon)\n"
                    f"reason: str (Explication concise de la validation ou de l'invalidation)\n"
                    
                    f"### Contraintes STRICTES :\n"
                    f"1. Ne retournez qu'un SEUL bloc YAML.\n"
                    f"2. N'ajoutez aucun texte en dehors du bloc YAML.\n"
                    f"3. Utilisez EXACTEMENT les noms de champs suivants : `is_valid` et `reason`.\n"
                    f"4. Assurez-vous que l'indentation est correcte.\n"
                )

                
                validation_response = query_mistral(prompt_for_validation)
                
                # Étape 2 : Extraire la validation de Mistral
                validation_data = extract_validation(validation_response)
                
                # Étape 3 : Informer l'utilisateur de la validation
                if validation_data["is_valid"] :
                    print(f"Mistral a validé la commande :  {validation_data['reason']}")
                    is_valid = "est validé"
                else:
                    print(f"Mistral a rejeté la commande :  {validation_data['reason']}")
                    is_valid = "n'est pas validé"

                
                # # Étape 4 : Proposer un choix à l'utilisateur
                # print("Que souhaitez-vous faire ?")
                # choice = input("Voulez-vous (1) exécuter votre commande ou (2) revenir à la commande initiale ? (1/2) : ").strip()
                # if choice == '1':
                    # L'utilisateur choisit d'exécuter sa commande
                    
                send_validation(user_alternative, is_valid)  # Envoie la validation au backend
                print("En attente de validation de l'utilisateur...")
                choice, enumerate_command = get_user_validation()
                print("votre choix", choice)  # Attendre la réponse du frontend
                if choice == 'o':
                    print("La commande alternative sera exécutée.")
                else :
                    print("la commande initiale sera exécutée.")

                tool_name = extract_tool_from_command(enumerate_command)
                # elif choice == '2':
                #     # L'utilisateur choisit de revenir à la commande initiale
                #     print("Retour à la commande initiale proposée par Mistral.")
                # else:
                #     # Réponse invalide
                #     print("Réponse non reconnue. Prochaine itération")
                #     break  # Passage à la phase suivante en cas de réponse invalide
            else:
                # Aucune commande alternative fournie
                print("Programme arrêté par l'utilisateur.")
                # Construis le prompt pour le rapport final
                prompt_report = (
                    f"tu es expert en tests de pénétration, ci-dessous le contexte et les commandes précédemment exécutées sur cette cible {target}:\n"
                )
                for entry in history:
                    prompt_report += f"Commande executée: {entry['command']}\n Résultat:\n{entry['result']}\n\n ."

                prompt_report += (
                    "En te basant sur ces informations écris un rapport détaillé sur ce qui a été trouvés et les recommandantions."
                )

                
                print(f"\n=== Rapport Final de l'Énumération ===\n")
                report = query_mistral(prompt_report)
                if not report:
                    print("Impossible de générer le rapport. Vérifiez la communication avec Mistral.")
                    return

                file_path = "C:\\Users\\AZIZ\\Desktop\\enumeration_report.txt"
                # Sauvegarde le rapport dans un fichier
                with open(file_path, "w") as f:
                    f.write(report)

                return report
                exit()  # Arrêter le programme si aucune commande n'est fournie
        else:
            # Réponse invalide
            print("Réponse non reconnue. Le programme va passer à la prochaine itération.")
            break  # Passage à la phase suivante en cas de réponse invalide

    
        # Exécute la commande 
        if enumerate_command:
                result = execute_command_docker(enumerate_command)
                if "not found" in result:
                        print("[DEBUG] L'outil requis est absent.Tentative d'installation...")
                        if user_alternative:
                            install_command = None
                        install_success = check_and_install_tool(tool_name, install_command)
                        if not install_success:
                            print(f"[ERREUR] Impossible d'installer l'outil '{tool_name}',ne plus proposer de commandes avec.")
                            history.append({"command": enumerate_command, "result": f"[ERREUR] L'outil '{tool_name}' n'a pas pu être installé."})
                            break
                        
                        # Réexécute la commande après installation
                        print(f"[INFO] Réexécution de la commande après installation de l'outil '{tool_name}'.")
                        result = execute_command_docker(enumerate_command)

                        if not result:  # Vérifie simplement si la commande a échoué (pas de "not found")
                            print(f"[ERREUR] La commande a échoué après installation de l'outil '{tool_name}'.")
                            history.append({"command": enumerate_command, "result": "[ERREUR] La commande a échoué après installation de l'outil."})
                            break


                if result:
                    analyzed_result = analyze_result_with_mistral(result, target,enumerate_command)
                    if analyzed_result:
                        print(f"[INFO] Analyse réussie ")
                        history.append({"command": enumerate_command, "result": analyzed_result})  # Ajoute la commande et son analyse à l'historique
                    else:
                        print("[INFO] Analyse impossible. Ajout du résultat brut à l'historique.")
                        history.append({"command": enumerate_command, "result": result})  # Ajoute le résultat brut à l'historique
                else:
                    print("La commande d'énumération a échoué. Vérifiez la cible ou les permissions.")
                    history.append({"command": enumerate_command, "result": "[ERREUR] La commande a échoué."})
                
        phase2=True

        
    # Phase 2 : Prompts suivants (9 étapes)
    for step in range(1, 4):  # 9 étapes supplémentaires
        print(f"\n=== Étape {step + 1} / 10 ===")

         # Initialisation par défaut de prompt
        prompt = f"Cible : {target}\nHistorique des commandes exécutées :\n"


        # Construis le prompt avec tout l'historique

        if history :
            for entry in history:

                prompt = f"Commande executée: {entry['command']}\n Résultat:\n{entry['result']}\n\n ."
            else:
                prompt += "Aucune commande exécutée pour le moment.\n"
        prompt += f"""
            En te basant sur ces informations, donne la prochaine commande à exécuter sur cette cible {target} afin de compléter de maniére optimale le pentest et la commande d'installation de l'outil
            
            Vous devez retourner les informations suivantes dans un fichier YAML bien structuré :
            - **tool_name** : Le nom de l'outil utilisé.
            - **enumerate_command** : La commande d'énumération pour la phase Information Gathering.
            - **install_command** : La commande d'installation de l'outil.

            ### Format OBLIGATOIRE (ne pas modifier)
            ```yaml
            tool_name: <nom_de_l_outil>
            enumerate_command: <cmd_enum>
            install_command: <cmd_install>
            Respectez **exactement** ce format. Aucune explication supplémentaire.

            ### Contraintes STRICTES
            1. **Une SEULE commande par réponse** :
            - Générez uniquement une commande pour la phase actuelle.
            - N'incluez pas d'alternatives, de propositions supplémentaires ou d'étapes futures.

            2. **Respectez l'ordre des phases** :
            - Phase 1 : Information Gathering (4 commandes au total).
            - Phase 2 : Énumération (3 commandes au total).
            - Phase 3 : Analyse de Vulnérabilités (2 commandes au total).

            3. **Commandes valides uniquement** :
            - TOUJOURS fournir une commande d'installation Valide.
            - Ne pas inclure `sudo` (géré par l'environnement).
            - Ne pas utiliser ni installer des dépôts GitHub.
            - Ne pas effectuer de scans sur tous les ports ; choisissez uniquement les ports les plus courants.

            4. **Évitez les doublons** :
            - Si une commande a déjà été générée, ne la regénérez pas.

            5. **Répondez uniquement avec le fichier YAML requis** :
            - Ne fournissez aucun texte explicatif ou commentaire en dehors du bloc YAML.

            6. **Autres contraintes spécifiques** :
            - Je suis sur Kali Linux : générez des commandes uniquement pour cette distribution.
            - Assurez-vous que l'indentation est correcte dans le fichier YAML.
            - Ne pas inclure d'espaces inutiles ou de caractères supplémentaires.
        
            ###Tâche
            Générez la prochaine commande pour la phase actuelle.
            """

        response = query_mistral(prompt)
        if not response:
            print("Impossible de communiquer avec Mistral ou réponse invalide.")
            continue

        # Extraire les commandes
        commands = extract_commands(response)
        if not commands:
            print("Impossible d'extraire les informations depuis la réponse YAML de Mistral.")
            continue

        # Accès aux informations extraites
        tool_name = commands.get("tool_name")
        enumerate_command = commands.get("enumerate")
        install_command = commands.get("install")

        print(f"Nom de l'outil : {tool_name}")
        print(f"Commande d'énumération extraite : {enumerate_command}")
        print(f"Commande d'installation extraite : {install_command}")

        # Demander confirmation à l'utilisateur
        # print(f">>> {enumerate_command}")
        # user_confirmation = input("Voulez-vous utiliser cette commande ? (o/n) : ").strip().lower()
        # Demander confirmation à l'utilisateur
        print(f">>> {enumerate_command}")
        send_command(enumerate_command)
        user_confirmation = 'o'        
        user_alternative = None 
        get_unpause()
        # send_pause_request(enumerate_command)  # Envoie une requête pour indiquer que l'on attend une réponse
        # print("En attente de confirmation de l'utilisateur...")

        # # Attendre la réponse du frontend
        # user_confirmation, user_alternative = get_user_response()
        
        # print(f"Réponse reçue : {user_confirmation}")
        # print(f"commande de l'utilisateur : {user_alternative}")
                
        if user_confirmation == 'o':
            # L'utilisateur confirme, on garde la commande initiale
            print("La commande d'énumération a été confirmée.")
            
        elif user_confirmation == 'n':
            if user_alternative:
                print("Validation de la commande d'énumération par celle de l'utilisateur...")
                # Étape 1 : Envoyer la commande alternative à Mistral pour validation
                prompt_for_validation = (
                    f"Contexte :\n"
                    f"- Cible : {target}\n"
                    f"- Historique des commandes exécutées :\n"
                )
                for entry in history:
                    prompt_for_validation += f"  - Commande : {entry['command']}, Résultat : {entry['result']}\n"
                prompt_for_validation += (
                    f"\nL'utilisateur propose la commande suivante : {user_alternative}\n"
                    f"Est-ce une commande pertinente et optimale pour le test de pénétration ?\n"
                    f"Répondez STRICTEMENT dans le format YAML suivant :"
                    f"```yaml"
                    f"is_valid: bool (True si la commande est valide, False sinon)\n"
                    f"reason: str (Explication concise de la validation ou de l'invalidation)\n"
                    
                    f"### Contraintes STRICTES :\n"
                    f"1. Ne retournez qu'un SEUL bloc YAML.\n"
                    f"2. N'ajoutez aucun texte en dehors du bloc YAML.\n"
                    f"3. Utilisez EXACTEMENT les noms de champs suivants : `is_valid` et `reason`.\n"
                    f"4. Assurez-vous que l'indentation est correcte.\n"
                )

                
                validation_response = query_mistral(prompt_for_validation)
                
                # Étape 2 : Extraire la validation de Mistral
                validation_data = extract_validation(validation_response)
                
                # Étape 3 : Informer l'utilisateur de la validation
                if validation_data["is_valid"] :
                    print(f"Mistral a validé la commande :  {validation_data['reason']}")
                    is_valid = "validé"
                else:
                    print(f"Mistral a rejeté la commande :  {validation_data['reason']}")
                    is_valid = "n'est pas validé"
                
                # # Étape 4 : Proposer un choix à l'utilisateur
                # print("Que souhaitez-vous faire ?")
                # choice = input("Voulez-vous (1) exécuter votre commande ou (2) revenir à la commande initiale ? (1/2) : ").strip()
                # if choice == '1':
                    # L'utilisateur choisit d'exécuter sa commande
                    
                send_validation(user_alternative, is_valid)  # Envoie la validation au backend
                print("En attente de validation de l'utilisateur...")
                choice, enumerate_command=get_user_validation()
                print("votre choix", choice)  # Attendre la réponse du frontend
                if choice == 'o':
                    print("La commande alternative sera exécutée.")
                else :
                    print("la commande initiale sera exécutée.")

                tool_name = extract_tool_from_command(enumerate_command)
                # elif choice == '2':
                #     # L'utilisateur choisit de revenir à la commande initiale
                #     print("Retour à la commande initiale proposée par Mistral.")
                # else:
                #     # Réponse invalide
                #     print("Réponse non reconnue.Passage à la phase suivante.")
                #     continue  # Passage à la phase suivante en cas de réponse invalide
            else:
                print("Programme arrêté par l'utilisateur.")
                # Construis le prompt pour le rapport final
                prompt_report = (
                    f"tu es expert en tests de pénétration, ci-dessous le contexte et les commandes précédemment exécutées sur cette cible {target}:\n"
                )
                for entry in history:
                    prompt_report += f"Commande executée: {entry['command']}\n Résultat:\n{entry['result']}\n\n ."

                prompt_report += (
                    "En te basant sur ces informations écris un rapport détaillé sur ce qui a été trouvés et les recommandantions."
                )

                
                print(f"\n=== Rapport Final de l'Énumération ===\n")
                report = query_mistral(prompt_report)
                if not report:
                    print("Impossible de générer le rapport. Vérifiez la communication avec Mistral.")
                    return
                
                file_path = "C:\\Users\\AZIZ\\Desktop\\enumeration_report.txt"
                # Sauvegarde le rapport dans un fichier
                with open(file_path, "w") as f:
                    f.write(report)
                
                return report

         
                exit()  # Arrêter le programme si aucune commande n'est fournie
        else:
            # Réponse invalide
            print("Réponse non reconnue. Le programme va passer à la prochaine itération.")
            continue


        # Exécute la commande 
        if enumerate_command:
                result = execute_command_docker(enumerate_command)
                if "not found" in result:
                        print("[DEBUG] L'outil requis est absent.Tentative d'installation...")
                        if user_alternative:
                            install_command = None
                        install_success = check_and_install_tool(tool_name, install_command)
                        if not install_success:
                            print(f"[ERREUR] Impossible d'installer l'outil '{tool_name}',ne plus proposer de commandes avec.")
                            history.append({"command": enumerate_command, "result": f"[ERREUR] L'outil '{tool_name}' n'a pas pu être installé."})
                            continue
                        
                        # Réexécute la commande après installation
                        print(f"[INFO] Réexécution de la commande après installation de l'outil '{tool_name}'.")
                        result = execute_command_docker(enumerate_command)

                        if not result:  # Vérifie simplement si la commande a échoué (pas de "not found")
                            print(f"[ERREUR] La commande a échoué après installation de l'outil '{tool_name}'.")
                            history.append({"command": enumerate_command, "result": "[ERREUR] La commande a échoué après installation de l'outil."})
                            continue


                if result:
                    analyzed_result = analyze_result_with_mistral(result, target,enumerate_command)
                    if analyzed_result:
                        print(f"[INFO] Analyse réussie : {analyzed_result}")
                        history.append({"command": enumerate_command, "result": analyzed_result})  # Ajoute la commande et son analyse à l'historique
                    else:
                        print("[INFO] Analyse impossible. Ajout du résultat brut à l'historique.")
                        history.append({"command": enumerate_command, "result": result})  # Ajoute le résultat brut à l'historique
                else:
                    print("La commande d'énumération a échoué. Vérifiez la cible ou les permissions.")
                    history.append({"command": enumerate_command, "result": "[ERREUR] La commande a échoué."})
                    continue


    # Phase 3 : Rapport final (11ème étape)
    print("\n=== Étape 11 / 11 : Génération du Rapport ===")

    # Construis le prompt pour le rapport final
    prompt_report = (
        f"tu es expert en tests de pénétration, ci-dessous le contexte et les commandes précédemment exécutées sur cette cible {target}:\n"
    )
    for entry in history:
        prompt_report += f"Commande executée: {entry['command']}\n Résultat:\n{entry['result']}\n\n ."

    prompt_report += (
        "En te basant sur ces informations écris un rapport détaillé sur ce qui a été trouvés et les recommandantions."
    )

    
    print(f"\n=== Rapport Final de l'Énumération ===\n")
    report = query_mistral(prompt_report)
    if not report:
        print("Impossible de générer le rapport. Vérifiez la communication avec Mistral.")
        return

    print(report)
    
    file_path = "C:\\Users\\AZIZ\\Desktop\\enumeration_report.txt"
    # Sauvegarde le rapport dans un fichier
    with open(file_path, "w") as f:
        f.write(report)
    
    return report
if __name__ == "__main__":
        main("par defaut")
        