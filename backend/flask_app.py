import requests
import subprocess
import re
import argparse

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


# Fonction pour interroger Mistral via Ollama
def query_mistral(prompt, api_url="http://host.docker.internal:11434/api/generate"):
    """
    Envoie une requête HTTP POST à l'API Ollama et récupère la réponse de Mistral.
    """
    try:
        # Prépare la requête JSON
        payload = {
            "model": "mistral",  # Spécifie le modèle à utiliser
            "prompt": prompt,
            "stream": False,  # Désactive le streaming pour une réponse complète
            "temperature": 0.9,  # Contrôle la créativité (0 = plus déterministe, 1 = plus aléatoire)
            "top_p": 0.9,  # Filtrage probabiliste des tokens
            "top_k": 40,  # Limite le nombre de tokens générés
            "max_tokens": 150  # Limite la longueur de la sortie
        }

        # Envoie la requête HTTP POST
        response = requests.post(api_url, json=payload, headers={"Content-Type": "application/json"})

        # Vérifie le statut de la réponse
        if response.status_code != 200:
            print(f"[DEBUG] Code de statut HTTP non valide : {response.status_code}")
            print(f"[DEBUG] Message d'erreur : {response.text.strip()}")
            return None

        # Récupère la réponse JSON
        data = response.json()
        mistral_response = data.get("response", "").strip()

        print(f"[DEBUG] Réponse brute de Mistral : {mistral_response}")
        return mistral_response
    except requests.exceptions.RequestException as e:
        print(f"[DEBUG] Erreur lors de la communication avec l'API Ollama : {e}")
        return None 
    except Exception as e:
        print(f"[DEBUG] Erreur générale : {e}")
        return None


# Fonction pour extraire les commandes
def extract_commands(response):
    """
    Extrait les commandes d'énumération et d'installation de la réponse générée.
    """
    commands = {}
    lines = response.splitlines()

    for line in lines:

        # Supprime les backticks autour de chaque ligne avant extraction
        line = line.replace("`", "").strip()

         # Extraction de la commande d'énumération
        if line.startswith("Commande d'enum :"):
            commands["enumerate"] = line.replace("Commande d'enum :", "").strip()

        # Extraction de la commande d'installation (gère l'espacement incohérent)
        elif line.lower().startswith("commande d'install :"):
            commands["install"] = line.replace("Commande d'install :", "").strip()

    # Si aucune commande d'énumération n'est trouvée, utilise la première ligne comme fallback
    if not commands.get("enumerate") and lines:
        commands["enumerate"] = lines[0].strip()  # Utilise la première ligne comme fallback
        commands["install"] = "None"  # Aucune installation nécessaire



    return commands.get("enumerate"), commands.get("install")


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
            # ["docker", "exec", "-i", container_name, "bash", "-c", full_command],
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
    ### Rôle et Objectif
    Vous êtes un expert en cybersécurité spécialisé en tests d'intrusion. Votre mission est de **générer et analyser** des commandes pour les phases suivantes :
    1. **Information Gathering**
    2. **Énumération**
    3. **Analyse de vulnérabilités**  
    Vous interagissez uniquement avec le terminal et **n'ajoutez aucun texte inutile**.

    ### Input
    - **Cible** : {target}  
    (Cela peut être une IP, un réseau CIDR, une plage d'IP ou un domaine)

    ### Output attendu
    Générez **deux commandes** :
    1. **Commande d'exécution** pour effectuer la phase en cours.
    2. **Commande d'installation** de l'outil utilisé.

    ### Format OBLIGATOIRE (ne pas modifier)
    Commande d'enum : <cmd enum> Commande d'install : <cmd install> --yes --force-yes 
    Respectez **exactement** ce format. Aucune explication supplémentaire.

    ### Contraintes
    - **Respectez l'ordre des phases** : Info Gathering 4 commandes → Énumération 3 commandes → Analyse de vulnérabilités 2 commandes.
    - **Une seule commande par catégorie** (pas d'alternatives).
    - **Ne pas inclure 'sudo'** (géré par l'environnement).
    - **Toujours donner une commande d'installation** avant utilisation d'un outil.
    - **Aucune explication ni dialogue inutile**.
    - **ne pas faire de scan sur tout les ports choisir les plus courrants **.
    - **je suis sur Ubuntu Debian ne genere de commande que pour cette distribution**.
    - **si une commande a déja été générée ne la regénérer pas**.
    - **ne pas utiliser ni installer des repo github **.

    Générez la première commande pour la phase **Information Gathering**.
    [/INST]</s>
    """


    # Interroge Mistral avec le prompt initial
    response = query_mistral(prompt_initial)
    if not response:
        print("Impossible de communiquer avec Mistral ou réponse invalide.")
        return

    # Extrayez la première commande
    enumerate_command, install_command = extract_commands(response)
    if not enumerate_command:
        print("Impossible d'extraire la commande d'énumération. Vérifiez le format de la réponse de Mistral.")
        return

    print(f"Commande d'énumération initiale extraite : {enumerate_command}")
    print(f"Commande d'installation initiale extraite : {install_command}")

    # Exécute la commande initiale
    if enumerate_command:
            result = execute_command_docker(enumerate_command)
            if result == "tool_not_found":
                print("[DEBUG] L'outil requis est absent. Tentative d'installation...")
                if install_command and install_command.lower() != "none":
                    install_result = execute_command_docker(install_command)
                    if install_result:
                        print("[DEBUG] Installation réussie. Réessayez la commande d'énumération...")
                        result = execute_command_docker(enumerate_command)
                        if result:
                            history.append({"command": enumerate_command, "result": result})
                        else:
                            print("La commande d'énumération a échoué même après l'installation de l'outil.")
                            return
                    else:
                        print("L'installation de l'outil a échoué. Annulation de l'étape suivante.")
                        return
                else:
                    print("Aucune commande d'installation fournie. Impossible de continuer.")
                    return
            elif result:
                history.append({"command": enumerate_command, "result": result})  # Ajoute la commande et son résultat à l'historique
            else:
                print("La commande d'énumération a échoué. Vérifiez la cible ou les permissions.")
                return


    # Phase 2 : Prompts suivants (9 étapes)
    for step in range(1, 3):  # 9 étapes supplémentaires
        print(f"\n=== Étape {step + 1} / 10 ===")

        # Construis le prompt avec tout l'historique

        for entry in history:
            prompt = f"Commande executée: {entry['command']}\n Résultat:\n{entry['result']}\n\n ."

        prompt += f"""
    En te basant sur ces informations, donne la prochaine commande à exécuter sur cette cible {target} afin de compléter de maniére optimale le pentest et la commande d'installation de l'outil
    
    ### Format OBLIGATOIRE (ne pas modifier)
    Commande d'enum : <cmd enum> Commande d'install : <cmd install> --yes --force-yes 
    Respectez **exactement** ce format. Aucune explication supplémentaire.
    ### Contraintes
    - **Respectez l'ordre des phases**
    - **Une seule commande par catégorie** (pas d'alternatives).
    - **Ne pas inclure 'sudo'** (géré par l'environnement).
    - **Toujours donner une commande d'installation** avant utilisation d'un outil.
    - **Aucune explication ni dialogue inutile**.
    - **ne pas faire de scan sur tout les ports choisir les plus courrants **.
    - **ne pas utiliser ni installer des repo github **.
    """

        response = query_mistral(prompt)
        if not response:
            print("Impossible de communiquer avec Mistral ou réponse invalide.")
            return

        # Extrayez la commande
        enumerate_command, install_command = extract_commands(response)
        if not enumerate_command:
            print("Impossible d'extraire la commande d'énumération. Vérifiez le format de la réponse de Mistral.")
            return

        print(f"Commande d'énumération extraite : {enumerate_command}")
        print(f"Commande d'installation extraite : {install_command}")

        # Exécute la commande
        if enumerate_command:
                result = execute_command_docker(enumerate_command)
                if "not found" in result:
                    print("[DEBUG] L'outil requis est absent. Tentative d'installation...")
                    if install_command and install_command.lower() != "none":
                        install_result = execute_command_docker(install_command)
                        if install_result:
                            print("[DEBUG] Installation réussie. Réessayez la commande d'énumération...")
                            result = execute_command_docker(enumerate_command)
                            if result:
                                history.append({"command": enumerate_command, "result": result})
                            else:
                                print("La commande d'énumération a échoué même après l'installation de l'outil.")
                                return
                        else:
                            print("L'installation de l'outil a échoué. Annulation de l'étape suivante.")
                            return
                    else:
                        print("Aucune commande d'installation fournie. Impossible de continuer.")
                        return
                elif result:
                    history.append({"command": enumerate_command, "result": result})  # Ajoute la commande et son résultat à l'historique
                else:
                    print("La commande d'énumération a échoué. Vérifiez la cible ou les permissions.")
                    return


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

    # Sauvegarde le rapport dans un fichier
    with open("enumeration_report.txt", "w") as f:
        f.write(report)

    print("Rapport sauvegardé dans 'enumeration_report.txt'.")


if __name__ == "__main__":
    main("arg par defaut")
    