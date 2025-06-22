import requests 
import subprocess
import re
import argparse
import yaml 
import json
import os
import time
from typing import Dict, List, Any, Optional, Tuple, Set
import hashlib
from jinja2 import Environment, FileSystemLoader
import pdfkit
from datetime import datetime
import smtplib
import requests

# Base de données locale pour suivre les commandes déjà exécutées
COMMAND_HISTORY_FILE = "command_history.json"
# Base de données locale pour la validation des commandes
COMMAND_VALIDATION_FILE = "command_validation.json"
# Constantes de configuration
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TOKEN_LIMIT = 800  # Augmenté par défaut
ANALYSIS_TOKEN_LIMIT = 800
REPORT_TOKEN_LIMIT = 800
def clean_query(response):
    """
    Supprime les backticks et caractères spéciaux inutiles.
    """
    response = response.translate(str.maketrans('', '', '\\|"`*')).strip()
    if response.startswith("```yaml"):
        response = response[7:]
    if response.startswith("```"):
        response = response[3:]
    if response.endswith("```"):
        response = response[:-3]
    return response.strip()

def clean_command(response):
    """
    Nettoie une commande YAML ou bloc LLM en corrigeant indentation, blocs `|`, et lignes invalides.
    """
    response = clean_query(response)
    lines = response.splitlines()
    cleaned_lines = []

    current_key = None
    multiline_value = ""

    for line in lines:
        line = line.strip()

        # Ignorer lignes vides
        if not line:
            continue

        if line.endswith(": |"):
            current_key = line[:-2].strip()  # ex: install_command
            multiline_value = ""
            continue
        if line.endswith(": -"):
            current_key = line[:-2].strip()  
            multiline_value = ""
            continue

        # Cas des lignes suivantes du bloc
        if current_key:
            # On ajoute la valeur à la ligne précédente
            multiline_value += line.strip() + " "
            continue

        # Ligne normale avec :
        if ":" in line:
            cleaned_lines.append(line)

    # Ajouter la ligne reconstituée si on a traité un bloc `|`
    if current_key and multiline_value:
        multiline_line = f"{current_key}: {multiline_value.strip()}"
        cleaned_lines.append(multiline_line)

    return "\n".join(cleaned_lines)


def format_llm_yaml_response(yaml_str: str) -> dict:
    """
    Analyse une réponse YAML d'un LLM, potentiellement mal formatée, et retourne un dictionnaire structuré.
    Gère les cas d'indentation incorrecte et de caractères spéciaux.
    
    Args:
        yaml_str (str): La chaîne YAML à analyser, potentiellement mal formatée
        
    Returns:
        dict: Dictionnaire structuré contenant les données analysées
    """
    result = {
        "tool_name": "unknown",
        "command_executed": "",
        "status": "UNKNOWN",
        "services_discovered": []
    }
    
    # Suppression des lignes vides et des ```yaml/``` qui pourraient être présentes
    lines = [line for line in yaml_str.split('\n') if line.strip()]
    lines = [line for line in lines if not line.startswith('```')]
    
    current_service = None
    in_services_section = False
    service_section_indentation = 0
    
    for line in lines:
        line_content = line.strip()
        line_indentation = len(line) - len(line.lstrip())
        
        # Ignorer les lignes de commentaire
        if line_content.startswith('#'):
            continue
        
        # Détecter si on est au début d'une section services_discovered
        if "services_discovered:" in line_content.lower():
            in_services_section = True
            service_section_indentation = line_indentation
            continue
        
        # Traiter les lignes en fonction du contexte
        if in_services_section:
            # Si on a une ligne moins indentée que la section services, on sort de cette section
            if line_indentation <= service_section_indentation and not line_content.startswith('-'):
                in_services_section = False
                # Ajouter le dernier service s'il existe
                if current_service is not None:
                    result["services_discovered"].append(current_service)
                    current_service = None
            
            # Si on a un tiret, c'est un nouveau service
            if "-" in line_content and line_content.strip().startswith('-'):
                # Sauvegarder le service précédent si existant
                if current_service is not None:
                    result["services_discovered"].append(current_service)
                
                # Créer un nouveau service
                current_service = {
                    "nom": "",
                    "version": "N/A",
                    "port": None,
                    "protocole": "TCP",
                    "cpe": "N/A"
                }
                
                # Extraire la clé-valeur si elle existe sur la même ligne que le tiret
                rest_of_line = line_content.strip()[1:].strip()
                if ':' in rest_of_line:
                    key, value = rest_of_line.split(':', 1)
                    key = key.strip().lower()
                    value = value.strip()
                    
                    if key == "nom":
                        current_service["nom"] = value if value and value not in ["-", "unknown", "error"] else ""
                    elif key == "version":
                        current_service["version"] = value if value and value not in ["-", "unknown", "error"] else "N/A"
                    elif key == "port":
                        try:
                            port_value = ''.join(c for c in value if c.isdigit())
                            current_service["port"] = int(port_value) if port_value else None
                        except (ValueError, TypeError):
                            current_service["port"] = None
                    elif key == "protocole":
                        current_service["protocole"] = value.upper() if value in ["TCP", "UDP", "tcp", "udp"] else "TCP"
                    elif key == "cpe":
                        current_service["cpe"] = value if value and value not in ["-", "unknown", "error"] else "N/A"
            
            # Si on est dans un service et qu'on a une paire clé-valeur, c'est une propriété du service
            elif current_service is not None and ':' in line_content:
                key, value = line_content.split(':', 1)
                key = key.strip().lower()
                value = value.strip()
                
                if key == "nom":
                    current_service["nom"] = value if value and value not in ["-", "unknown", "error"] else ""
                elif key == "version":
                    current_service["version"] = value if value and value not in ["-", "unknown", "error"] else "N/A"
                elif key == "port":
                    try:
                        port_value = ''.join(c for c in value if c.isdigit())
                        current_service["port"] = int(port_value) if port_value else None
                    except (ValueError, TypeError):
                        current_service["port"] = None
                elif key == "protocole":
                    current_service["protocole"] = value.upper() if value in ["TCP", "UDP", "tcp", "udp"] else "TCP"
                elif key == "cpe":
                    current_service["cpe"] = value if value and value not in ["-", "unknown", "error"] else "N/A"
        
        # Traiter les paires clé-valeur principales (en dehors de la section services)
        elif ':' in line_content:
            key, value = line_content.split(':', 1)
            key = key.strip().lower()
            value = value.strip()
            
            if key == "tool_name":
                result["tool_name"] = value if value and value not in ["-", "unknown", "error"] else "unknown"
            elif key == "command_executed":
                result["command_executed"] = value
            elif key == "status":
                result["status"] = value.upper() if value else "UNKNOWN"
                # Normaliser le statut
                if result["status"] not in ["SUCCESS", "ERROR", "PARTIAL"]:
                    result["status"] = "UNKNOWN"    
    # Ajouter le dernier service s'il existe
    if current_service is not None:
        result["services_discovered"].append(current_service)
        
    print("resultat formaté et analysé", result)
    
    return result



def clean_and_analyze_result(analyzed_result: str) -> dict:
    """
    Nettoie et analyse le résultat du LLM de manière robuste
    """
    try:
        formatted_data = format_llm_yaml_response(analyzed_result)
        
        result = {
            "tool_name": formatted_data.get("tool_name", "unknown"),
            "status": formatted_data.get("status", "UNKNOWN"),
            "report_entries": [],  # Contiendra chaque ligne du tableau HTML
            "open_ports": [],
            "services": [],
            "cpe_list": []
        }

        # Extraction pour le rapport HTML
        services = formatted_data.get("services_discovered", [])
        for service in services:
            entry = {
                "port": service.get("port"),
                "technologie": service.get("nom"),
                "version": service.get("version", "N/A"),
                "cpe": service.get("cpe", "N/A"),
                "vulnerable": False,  # Mis à jour plus tard avec l'API CVE
                "cve": "—",
                "criticite": "—"
            }
            result["report_entries"].append(entry)

            # Pour usage futur
            if entry["cpe"] and entry["cpe"] != "N/A":
                result["cpe_list"].append(entry["cpe"])
            if entry["port"]:
                result["open_ports"].append(entry["port"])
            if entry["technologie"]:
                result["services"].append(entry["technologie"])

        
        # Validation du statut
        if result["status"] not in ["SUCCESS", "ERROR", "WARNING", "UNKNOWN"]:
            result["status"] = "UNKNOWN"
            
        return result
        
    except Exception as e:
        print(f"[ERREUR] Exception lors de l'analyse: {str(e)}")
        return {
            "tool_name": "unknown",
            "status": "ERROR", 
            "analysis": {"error": f"Erreur de traitement: {str(e)}"}
        }

def is_valid_tool_yaml(response: str) -> bool:
    try:
        cleaned = clean_command(response)
        print("YAML nettoyé:\n", cleaned)  # Debug
        
        # Charger le YAML
        data = yaml.safe_load(cleaned)
        
        # Validation des champs obligatoires
        required = ["tool_name", "enumerate_command"]
        if not all(field in data for field in required):
            print(f"[ERREUR] Champs manquants: {required}")
            return False
            
        return True
        
    except yaml.YAMLError as e:
        print(f"[ERREUR YAML] {e}")
        return False

def load_command_history() -> Dict:
    """Charge l'historique des commandes depuis le fichier local."""
    if os.path.exists(COMMAND_HISTORY_FILE):
        try:
            with open(COMMAND_HISTORY_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("[AVERTISSEMENT] Fichier d'historique corrompu. Création d'un nouveau.")
    return {"commands": [], "errors": {}}

def save_command_history(history: Dict) -> None:
    """Sauvegarde l'historique des commandes dans le fichier local."""
    with open(COMMAND_HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)

def load_command_validation() -> Dict:
    """Charge la base de validation des commandes depuis le fichier local."""
    if os.path.exists(COMMAND_VALIDATION_FILE):
        try:
            with open(COMMAND_VALIDATION_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("[AVERTISSEMENT] Fichier de validation corrompu. Création d'un nouveau.")
    return {"tools": {}}

def save_command_validation(validation: Dict) -> None:
    """Sauvegarde la base de validation des commandes dans le fichier local."""
    with open(COMMAND_VALIDATION_FILE, 'w') as f:
        json.dump(validation, f, indent=2)

def query_llm(prompt, api_url="http://host.docker.internal:8080/v1/chat/completions", 
              max_tokens_override=None, retry_count=0):
    """
    Envoie une requête à l'API REST de llama.cpp (format OpenAI-like) avec gestion
    améliorée des tokens et des erreurs.
    """
    try:
        # Déterminer le nombre approprié de tokens pour la réponse
        max_tokens = DEFAULT_TOKEN_LIMIT
        
        # Ajustements spécifiques selon le type de requête
        if max_tokens_override:
            max_tokens = max_tokens_override
        elif "analyse des resultats" in prompt.lower():
            max_tokens = ANALYSIS_TOKEN_LIMIT
        elif "rapport" in prompt.lower():
            max_tokens = REPORT_TOKEN_LIMIT
        elif "commande d'énumération" in prompt.lower() or "enumerate_command" in prompt.lower():
            max_tokens = DEFAULT_TOKEN_LIMIT * 1.5  # Augmentation pour les commandes
            
        # Log pour le débogage
        print(f"[DEBUG] Requête avec {max_tokens} tokens maximum")
            
        # Payload compatible avec l'API de llama.cpp
        payload = {
            "model": "Mistral", 
            "messages": [
                {"role": "system", "content": "Imaginez que trois experts différents répondent à cette question. Tous les experts écriront 1 étape de leur réflexion, puis la partageront avec le groupe. Ensuite, tous les experts passeront à l'étape suivante, etc. Si un expert se rend compte qu'il a tort à un moment donné, alors il part."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.8, 
            "top_p": 0.9,
            "max_tokens": int(max_tokens),
            "stream": False,
            "echo": False
        }
        # stop = char sur lequel le llm s'arrete 
        # echo = si le prompt en renvoyer par le llm 
        # ctx_size = taille memoire
        # batch_size = vitesse 
        # repeat_penalty # penaliter pour les reponses repetitives
        
        # En-têtes nécessaires
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        print("[QUERY] Envoi de la requête à l'API...")
        response = requests.post(api_url, json=payload, headers=headers)
        response.raise_for_status()

        # Récupère la réponse (format OpenAI)
        data = response.json()
        llm_response = data["choices"][0]["message"]["content"].strip()
        
        # Pour les réponses de commandes, vérifier si le format YAML est respecté
        if "tool_name:" in prompt and "enumerate_command:" in prompt:
            # llm_response = clean_command(llm_response)  # Nettoyer la réponse
            yaml_valid = is_valid_tool_yaml(llm_response)
            print("[DEBUG] Validation YAML:", yaml_valid)
            if not yaml_valid:
                print("[ERREUR] Réponse mal formatée. Nouvel essai...")
                if retry_count < MAX_RETRY_ATTEMPTS:
                    # Reformuler le prompt pour insister sur le format YAML complet
                    enhanced_prompt = prompt + "\n\nCRITIQUE: Ta réponse précédente était incorrecte ou incomplète. Tu DOIS répondre UNIQUEMENT avec un YAML valide contenant AU MINIMUM 'tool_name:' et 'enumerate_command:' clairement définis. Vérifie la syntaxe YAML. Et sans texte supplémentaire"
                    return query_llm(enhanced_prompt, api_url, max_tokens_override, retry_count + 1)
                else:
                    print(f"[ERREUR] Échec après {MAX_RETRY_ATTEMPTS} tentatives. Dernière réponse: {llm_response}")
                    
        return llm_response

    except requests.exceptions.RequestException as e:
        print(f"[ERREUR] Problème de requête HTTP: {e}")
        if 'response' in locals():
            print(f"[DEBUG] Réponse brute: {response.text}")
        
        # Gestion des réessais avec délai exponentiel
        if retry_count < MAX_RETRY_ATTEMPTS:
            wait_time = 2 ** retry_count
            print(f"[INFO] Nouvel essai dans {wait_time} secondes...")
            time.sleep(wait_time)
            return query_llm(prompt, api_url, max_tokens_override, retry_count + 1)
        return None
        
    except Exception as e:
        print(f"[ERREUR] Erreur inattendue: {e}")
        return None

def validate_command(tool_name: str, command: str, container_name = "kali-pentest") -> Tuple[bool, str]:
    """
    Valide une commande d'énumération pour s'assurer qu'elle utilise des arguments valides.
    Retourne (True, command) si valide, (False, message d'erreur) sinon.
    
    Args:
        tool_name: Nom de l'outil, utilisé pour le message (peut être différent de la commande)
        command: La commande complète à valider
        container_name: Le nom du conteneur Docker où exécuter la commande
    
    Returns:
        Tuple de (est_valide, message)
    """
    try:
        cmd_parts = command.split()
        if not cmd_parts:
            return False, "Commande vide"
        
        tool = cmd_parts[0]
        
        # Extraire le manuel de l'outil
        man_result = subprocess.run(
            [f"man {tool} 2>/dev/null || {tool} --help 2>&1 || {tool} -h 2>&1"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10, shell=True
        )
        
        man_text = man_result.stdout.lower()
        
        if not man_text:
            return False, f"Impossible d'obtenir la documentation pour {tool}"
        
        # Extraire toutes les options possibles du manuel
        valid_options = extract_options_from_man(man_text)
        
        if not valid_options:
            # Si on n'a pas pu extraire d'options, on avertit mais on continue
            return True, f"Attention: Impossible d'extraire les options valides pour {tool}, validation limitée"
        
        # Vérifier chaque argument
        i = 1
        while i < len(cmd_parts):
            arg = cmd_parts[i]
            
            # Si c'est une option (commence par -)
            if arg.startswith('-'):
                # Extraire le nom de l'option sans le tiret initial
                option_name = arg.lstrip('-')
                
                # Gérer les options combinées comme -abc (équivalent à -a -b -c)
                if len(option_name) > 1 and arg.startswith('-') and not arg.startswith('--'):
                    # Pour chaque caractère dans l'option combinée
                    for char in option_name:
                        if not is_valid_option(f"-{char}", valid_options):
                            return False, f"Option invalide dans la combinaison {arg}: -{char}"
                        
                else:
                    # Vérifier si l'option est valide
                    if not is_valid_option(arg, valid_options):
                        return False, f"Option non reconnue: {arg}"
                    
                    # Vérifier si l'option attend une valeur
                    if needs_value(arg, valid_options) and i + 1 < len(cmd_parts) and not cmd_parts[i+1].startswith('-'):
                        # Sauter la valeur de l'option
                        i += 1
            
            i += 1
            
        return True, command
    
    except subprocess.TimeoutExpired:
        return False, f"Timeout lors de la lecture de la documentation pour {tool}"
    except Exception as e:
        return False, f"Erreur lors de la validation: {str(e)}"

def extract_options_from_man(man_text: str) -> Dict[str, bool]:
    """
    Extrait les options valides du texte du manuel.
    
    Returns:
        Dictionnaire avec les options comme clés et un booléen indiquant si l'option attend une valeur
    """
    valid_options = {}
    
    # Rechercher les sections pertinentes (OPTIONS, DESCRIPTION, etc.)
    sections = re.findall(r'(options|arguments)[\s\n]+(.*?)(\n\n|\n[A-Z]+|\Z)', man_text, re.DOTALL | re.IGNORECASE)
    
    # Pattern pour détecter les options dans le texte
    option_patterns = [
        # Format long et court avec description
        r'(-[a-z0-9], --[a-z0-9-]+|\s+--[a-z0-9-]+|\s-[a-z0-9])\s+([^\n]*)',
        # Format court uniquement
        r'\s(-[a-z0-9])[,\s]',
        # Format long uniquement
        r'\s(--[a-z0-9-]+)[,\s=]'
    ]
    
    # Rechercher dans tout le texte si on ne trouve pas de section spécifique
    full_text = man_text
    
    for pattern in option_patterns:
        matches = re.finditer(pattern, full_text, re.IGNORECASE)
        for match in matches:
            option = match.group(1).strip()
            description = match.group(2).strip() if len(match.groups()) > 1 else ""
            
            # Nettoyer l'option
            options = re.findall(r'(-[^,\s]+|--[^,\s=]+)', option)
            
            # Déterminer si l'option prend une valeur
            takes_value = False
            value_indicators = ['=', '<', '[=', 'FICHIER', 'FILE', 'ARG', 'NUM', 'STR', 'VALUE']
            
            for indicator in value_indicators:
                if indicator.lower() in description.lower() or indicator.lower() in option.lower():
                    takes_value = True
                    break
                
            # Ajouter chaque variante de l'option
            for opt in options:
                valid_options[opt] = takes_value
    
    return valid_options

def is_valid_option(option: str, valid_options: Dict[str, bool]) -> bool:
    """
    Vérifie si une option est valide.
    """
    return option in valid_options

def needs_value(option: str, valid_options: Dict[str, bool]) -> bool:
    """
    Vérifie si une option nécessite une valeur.
    """
    return option in valid_options and valid_options[option]

def is_duplicate_command(command: str, history: List[Dict]) -> bool:
    """
    Vérifie si une commande est un doublon d'une commande précédente.
    """
    # Calculer un hash de la commande normalisée (sans espaces superflus)
    normalized_cmd = re.sub(r'\s+', ' ', command).strip()
    cmd_hash = hashlib.md5(normalized_cmd.encode()).hexdigest()
    print(f"[DEBUG] historique: {history}")
    
    for entry in history:
        if "command" in entry:
            try:
                # Extraire la commande précédente
                yaml_data = yaml.safe_load(entry["command"])
                if yaml_data and 'enumerate_command' in yaml_data:
                    prev_cmd = yaml_data['enumerate_command']
                    prev_normalized = re.sub(r'\s+', ' ', prev_cmd).strip()
                    prev_hash = hashlib.md5(prev_normalized.encode()).hexdigest()
                    
                    # Comparer les hash
                    if cmd_hash == prev_hash:
                        return True
                    
                    # Comparer également les commandes sans leurs arguments
                    cmd_base = normalized_cmd.split()[0]
                    prev_base = prev_normalized.split()[0]
                    
                    # Si c'est le même outil avec des arguments similaires (>50% de similitude)
                    if cmd_base == prev_base:
                        # Calculer la similitude des arguments
                        cmd_args = set(normalized_cmd.split()[1:])
                        prev_args = set(prev_normalized.split()[1:])
                        
                        if cmd_args and prev_args:  # Éviter la division par zéro
                            overlap = len(cmd_args.intersection(prev_args))
                            similarity = overlap / max(len(cmd_args), len(prev_args))
                            
                            if similarity > 0.5:  # Plus de 50% des arguments sont similaires
                                return True
            except Exception:
                continue
                
    return False

def update_command_errors(tool_name: str, command: str, error_msg: str) -> None:
    """
    Met à jour la base de données des erreurs de commande pour améliorer les générations futures.
    """
    history = load_command_history()
    
    if tool_name not in history["errors"]:
        history["errors"][tool_name] = []
        
    # Enregistrer l'erreur avec la commande problématique
    error_entry = {
        "command": command,
        "error": error_msg,
        "timestamp": time.time()
    }
    
    history["errors"][tool_name].append(error_entry)
    save_command_history(history)
    
    # Mise à jour également de la base de validation
    # validation_db = load_command_validation()
    
    # if tool_name not in validation_db["tools"]:
    #     validation_db["tools"][tool_name] = {"bad_args": []}
    
    # Tenter d'extraire l'argument problématique
    # args = command.split()[1:]
    # for arg in args:
    #     if arg in error_msg or (arg.startswith('-') and arg[1:] in error_msg):
    #         if arg not in validation_db["tools"][tool_name]["bad_args"]:
    #             validation_db["tools"][tool_name]["bad_args"].append(arg)
    
    # save_command_validation(validation_db)

def analyze_result_with_llm(raw_result, target, enumerate_command):
    """
    Envoie le résultat brut à llm pour analyse et extraction des informations essentielles.
    Version améliorée avec meilleur traitement des erreurs et focus sur les CPE/CVE.
    """
    try:
        # Extraire la commande réelle à partir du YAML si possible
        cmd_to_show = ""
        try:
            yaml_data = yaml.safe_load(enumerate_command)
            if yaml_data and 'enumerate_command' in yaml_data:
                cmd_to_show = yaml_data['enumerate_command']
            elif isinstance(enumerate_command, str):
                cmd_to_show = enumerate_command
        except:
            cmd_to_show = enumerate_command
            
        # Détection des erreurs dans le résultat
        error_detected = False
        if "error" in raw_result.lower() or "usage:" in raw_result.lower() or "command not found" in raw_result.lower():
            error_detected = True
            
        # Construis le prompt pour demander à llm d'analyser le résultat
        prompt = f"""
        <s>[INST]
        ### ANALYSE DE RÉSULTATS DE PENTEST

        En tant qu'expert en tests d'intrusion, analysez précisément ces résultats :

        Cible : {target}
        Commande exécutée : {cmd_to_show}
        Résultat {"contient des erreurs" if error_detected else "brut"} :
        
        {raw_result}
        

        ### FORMAT DE RÉPONSE STRICTEMENT REQUIS (YAML UNIQUEMENT)
        
        ```yaml
        tool_name: <nom_outil_utilisé>
        command_executed: <commande_exacte_exécutée>
        status: <SUCCESS|ERROR|PARTIAL>
        services_discovered:
              nom: <nom_service>
              version: <version_si_disponible>
              port: <port_nombre>
              protocole: <TCP|UDP>
              cpe: <identifiant_CPE_si_disponible>
        ```

        ### CONSIGNES CRITIQUES
        - UNIQUEMENT du YAML valide, PAS DE TEXTE en dehors
        - Si la commande a échoué, définir status: ERROR 
        - EXTRACTION FACTUELLE, pas de suppositions
        - Format PRÉCIS respectant la structure ci-dessus
        - SECTIONS VIDES autorisées si aucune donnée pertinente
        - EXHAUSTIVITÉ des informations pertinentes pour un pentest
        - PAS de suggestions ni recommandations, UNIQUEMENT des faits
        - IDENTIFIER les CPE (Common Platform Enumeration) quand possible

        Si la commande a échoué ou contient des erreurs, indiquez clairement status: ERROR et expliquez la raison de l'échec dans les points d'intérêt.

        Répondez UNIQUEMENT avec le YAML structuré, sans introduction ni conclusion.
        [/INST]</s>
        """
        # Interroge llm pour analyser le résultat avec un token limit augmenté pour l'analyse
        response = query_llm(prompt, max_tokens_override=ANALYSIS_TOKEN_LIMIT)
        if not response:
            print("[DEBUG] Impossible de communiquer avec llm pour analyser le résultat.")
            return None
        
        # response = clean_command(response)  # Nettoyage de la réponse
        # print("[DEBUG] Analyse brute de llm : \n", response)
        

        # # Vérifier si l'analyse indique une erreur dans la commande
        # try:
        #     yaml_data = yaml.safe_load(response)
        #     print("[DEBUG] Analyse de llm : ", yaml_data)
        #     if yaml_data and yaml_data.get('status', None) == 'ERROR':
        #         print("[ANALYSE] La commande a échoué selon l'analyse LLM.")
                
        #         # Récupérer le nom de l'outil et la commande
        #         tool_name = yaml_data.get('tool_name', 'unknown')
        #         command = yaml_data.get('command_executed', cmd_to_show)
                
        #         # Extraire la raison de l'erreur si disponible
        #         error_reason = ""
        #         if 'points_d_intérêt' in yaml_data.get('analysis', {}):
        #             error_reason = yaml_data['analysis']['points_d_intérêt']
                
        #         # Mettre à jour la base de données des erreurs
        #         update_command_errors(tool_name, command, error_reason)
        # except Exception as e:
        #     print(f"[DEBUG] Erreur lors de la vérification du statut: {e}")

        return response.strip()  # Retourne l'analyse nettoyée

    except Exception as e:
        print(f"[DEBUG] Erreur lors de l'analyse du résultat avec llm : {e}")
        return None

def generate_modified_prompt(base_prompt, tool_categories, current_phase):
    """
    Génère un prompt modifié en fonction des erreurs passées pour éviter les mêmes problèmes.
    """
    # Extraire les outils qui ont provoqué des erreurs
    problematic_tools = []
    problematic_args = []
    
    command_history = load_command_history()
    if command_history is None:
        print("[Info] Pas d'erreurs.")
        return base_prompt
    for tool, errors in command_history.get("errors", {}).items():
        if errors:  # Si des erreurs existent pour cet outil
            problematic_tools.append(tool)
            
            # Analyser les arguments problématiques
            for error_entry in errors:
                cmd = error_entry.get("command", "")
                args = cmd.split()[1:] if cmd and ' ' in cmd else []
                
                for arg in args:
                    if arg.startswith('-') and arg not in problematic_args:
                        problematic_args.append(arg)
    
    # Modifier le prompt en conséquence
    modified_prompt = base_prompt
    
    # Ajouter des avertissements concernant les outils et arguments problématiques
    warning_block = "\n### AVERTISSEMENTS BASÉS SUR L'HISTORIQUE\n"
    
    if problematic_tools:
        warning_block += f"- ÉVITER ces outils qui ont causé des erreurs: {', '.join(problematic_tools)}\n"
    
    warning_block += "- GÉNÉRER des commandes avec des arguments valides et compatibles avec Kali Linux\n"
    warning_block += "- PRÉFÉRER les commandes simples et robustes aux options complexes\n"
    warning_block += "- VALIDER que tous les arguments sont documentés dans le man de l'outil\n"
    
    # Ajouter l'accent sur l'identification des CPE pour faire le lien avec les CVE
    warning_block += "\n### FOCUS SUR L'IDENTIFICATION\n"
    warning_block += "- PRIVILÉGIER l'identification précise des services et leurs versions\n"
    warning_block += "- RECHERCHER les identifiants CPE (Common Platform Enumeration)\n"
    warning_block += "- ÉVITER les commandes d'exploitation active\n"
    warning_block += "- PRÉFÉRER les techniques d'énumération passive et de reconnaissance\n"
    
    # Insérer les avertissements avant la section des contraintes critiques
    if "### CONTRAINTES CRITIQUES" in modified_prompt:
        parts = modified_prompt.split("### CONTRAINTES CRITIQUES")
        modified_prompt = parts[0] + warning_block + "\n### CONTRAINTES CRITIQUES" + parts[1]
    else:
        # Si le bloc n'existe pas, ajouter à la fin
        modified_prompt += warning_block
    
    return modified_prompt


import requests
from typing import List

def enrich_report_with_cve(results_nested: List[List[dict]], nist_api_key: str = "939c9760-5aec-433f-a5b2-78e069208edd") -> List[List[dict]]:
    """
    Pour chaque entrée avec un ou plusieurs CPE, utilise nvdlib pour récupérer les CVE.
    Gère les entrées imbriquées sous forme de listes.
    """
    print("cpe input :", results_nested)
    for group in results_nested:
        if not isinstance(group, list):
            print(f"[IGNORÉ] Entrée non attendue dans results : {type(group)}")
            continue

        for entry in results_nested:
            if not isinstance(entry, dict):
                print(f"[IGNORÉ] Élément non valide : {entry}")
                continue

            # Recueillir toutes les informations disponibles pour une recherche plus précise
            cpe = entry.get("cpe", "").strip()
            technologie = entry.get("technologie", "").strip()
            version = entry.get("version", "").strip()
            port = entry.get("port", "")
            
            # Ignorer les entrées sans informations utilisables
            if (cpe.upper() == "NON_RENSEIGNÉ" and 
                (not technologie or technologie.upper() == "NON_RENSEIGNÉ") and
                (not version or version.upper() == "NON_RENSEIGNÉ")):
                continue
            
            all_cve_ids = set()
            criticity = "Basse"

            try:
                # Construire une requête de recherche enrichie
                search_terms = []
                
                # Ajouter le CPE s'il est disponible et utilisable
                if cpe and cpe.upper() != "NON_RENSEIGNÉ":
                    if cpe.startswith("cpe:/"):
                        # Extraire les parties utiles du CPE
                        cpe_parts = cpe[5:].split(':')
                        if len(cpe_parts) > 1:
                            search_terms.append(cpe_parts[1])  # vendor
                        if len(cpe_parts) > 2:
                            search_terms.append(cpe_parts[2])  # product
                        if len(cpe_parts) > 3 and cpe_parts[3]:
                            search_terms.append(cpe_parts[3])  # version
                
                # Ajouter la technologie si disponible
                if technologie and technologie.upper() != "NON_RENSEIGNÉ":
                    search_terms.append(technologie)
                
                # Ajouter la version si disponible et pas déjà incluse via CPE
                if version and version.upper() != "NON_RENSEIGNÉ" and version not in search_terms:
                    search_terms.append(version)
                
                # Si aucun terme de recherche n'est disponible, passer à l'entrée suivante
                if not search_terms:
                    continue
                    
                # Construire la requête de recherche
                keyword_search = " ".join(search_terms)
                
                # Construction de l'URL avec les paramètres
                base_url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
                params = {
                    "keywordSearch": keyword_search,
                    "resultsPerPage": 10
                }
                
                headers = {
                    "apiKey": nist_api_key
                }
                
                print(f"[INFO] Recherche pour: {keyword_search}")
                
                # Faire la requête à l'API
                response = requests.get(base_url, params=params, headers=headers)
                response.raise_for_status()
                
                data = response.json()
                vulnerabilities = data.get("vulnerabilities", [])
                total_results = data.get("totalResults", 0)
                
                print(f"[INFO] {total_results} résultats trouvés pour {keyword_search}")
                
                # Extraire les CVE jusqu'à 3 maximum
                count = 0
                for vuln in vulnerabilities:
                    if count >= 3:
                        break
                        
                    cve_item = vuln.get("cve", {})
                    cve_id = cve_item.get("id")
                    
                    if cve_id:
                        all_cve_ids.add(cve_id)
                        count += 1
                    
                    # Extraire la sévérité
                    metrics = cve_item.get("metrics", {})
                    severity = "UNKNOWN"
                    
                    if "cvssMetricV31" in metrics:
                        severity = metrics["cvssMetricV31"][0].get("cvssData", {}).get("baseSeverity", "UNKNOWN")
                    elif "cvssMetricV30" in metrics:
                        severity = metrics["cvssMetricV30"][0].get("cvssData", {}).get("baseSeverity", "UNKNOWN") 
                    elif "cvssMetricV2" in metrics:
                        severity = metrics["cvssMetricV2"][0].get("baseSeverity", "UNKNOWN")
                    
                    if severity in ("CRITICAL", "HIGH"):
                        criticity = "Haute"
                    elif severity == "MEDIUM" and criticity != "Haute":
                        criticity = "Moyenne"
                
                # Pause pour respecter les limites de l'API
                time.sleep(1)
                
            except Exception as e:
                print(f"[ERREUR] Recherche pour {' '.join(search_terms)} → {e}")

            if all_cve_ids:
                entry["vulnerable"] = True
                entry["cve"] = ", ".join(all_cve_ids)
                entry["criticite"] = criticity
            else:
                entry["vulnerable"] = False
                entry["cve"] = "—"
                entry["criticite"] = "Basse"

        return results_nested

def execute_command_docker(command, container_name="kali-pentest"):
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
            text=True,
            shell=True
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

def execute_install_docker(command, container_name="kali-pentest"):
    """
    Exécute une commande Linux dans un conteneur Docker.
    Retire automatiquement 'sudo' car nous sommes en tant que root.
    """
    try:
        full_command = command.replace("sudo ", "", 1)  # Retire 'sudo' si présent
        full_command = full_command.replace("`", "").strip()  # Supprime les backticks et les espaces inutiles
        full_command = full_command + " -y" 
        print(f"[DEBUG] Commande complète à exécuter : {full_command}")

        # Exécute la commande dans le conteneur
        result = subprocess.run(
            [full_command],
            capture_output=True,
            text=True,
            shell=True
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

def generate_command_validation_prompt(command, target, phase, results):
    """
    Génère un prompt structuré pour valider une commande de pentest selon l'approche "step by step"
    
    Args:
        command (str): La commande à valider
        target (str): La cible de la commande (IP, domaine, etc.)
        previous_constraints (list, optional): Liste des contraintes précédentes à respecter
        
    Returns:
        str: Un prompt formaté pour validation par LLM
    """
    
    print("[INFO] envoie de la requete corrective")
    
    # Construction du prompt de base
    prompt = f"""
    # Correction de commande de pentest

    Analysons étape par étape la commande proposée dans le cadre d'un test d'intrusion afin de l'améliorer la changer ou la garder veiller a garder le format et les champs de réponse :

    **Commande**: `{command}`
    **Cible**: `{target}`

    ## Validation par étapes

    ### 1. Vérification de la présence d'une commande et d'une cible
    - La commande est-elle spécifiée?
    - La cible est-elle spécifiée? 

    ### 2. Vérification du format de la commande
    - La syntaxe de la commande est-elle correcte? [ANALYSER LA SYNTAXE]
    - Les paramètres sont-ils correctement formés? [VÉRIFIER LES FLAGS ET ARGUMENTS]
    - Les options utilisées existent-elles pour cet outil? [VÉRIFIER LA VALIDITÉ DES OPTIONS]


    ### 3. Vérification de la validité de la commande
    - L'outil existe-t-il? [VÉRIFIER SI L'OUTIL EST STANDARD DANS UN ENVIRONNEMENT PENTEST]
    - Les paramètres sont-ils logiques pour cet outil? [VÉRIFIER LA COHÉRENCE]
    - La commande peut-elle s'exécuter sans erreur de syntaxe? [ANALYSER]

    ### 4. Vérification de la redondance
    - Cette commande a-t-elle déjà été exécutée précédemment? [ANALYSER AVEC LES INFORMATIONS DISPONIBLES]
    - Couvre-t-elle le même scope qu'une commande précédente? [ANALYSER]

    ### 5. Vérification de la cohérence dans le pentest
    - Cette commande est-elle appropriée pour la phase {phase} du pentest? [ANALYSER]
    - S'appuie-t-elle sur les informations déjà collectées {results} ? [VÉRIFIER]
    - Contribue-t-elle à l'avancement du test d'intrusion? [ÉVALUER]

    ### 6. Vérification de l'utilisabilité de l'outil
    - L'outil nécessite-t-il une interaction manuelle après son lancement? [ANALYSER]
    - Produit-il une sortie exploitable automatiquement? [VÉRIFIER]
    - Peut-il s'exécuter en mode non-interactif avec les paramètres fournis? [DÉTERMINER]

    ## Conclusion générale
    - En fonction des resultats trouvé veuillez modifiez, améliorez ou laissez tel quel la commande
    - Dans le cas ou plusieurs commande sont proposé choisis la meilleur et celle qui repond le plus au critére
    - La réponse devra strictement être sous cette forme :
    ### Format STRICT (YAML uniquement)
        ```yaml
        tool_name: <nom_outil_spécifique>
        enumerate_command: <commande_précise_avec_paramètres_optimaux>
        install_command: <commande_installation_si_nécessaire>
        ```
    ### Important
    - Aucune autre réponse ne sera accépter sauf celle sous le format yaml n'ajoute aucun autre texte sauf le yaml contenant la commande modifier ou garder

    """
    response = query_llm(prompt)

    return response


def main():
    print("=== Générateur de Commandes d'Énumération Amélioré ===")

    # Boucle pour demander une cible valide
    parser = argparse.ArgumentParser(description="Pentest Script")
    parser.add_argument("--target", required=True, help="Target (IP, range, domain, or website)")
    args = parser.parse_args()

    target = args.target
    print(f"Cible: {target}")
    
    # Initialisation des variables pour stocker l'historique
    history = []  # Liste pour stocker les commandes et leurs résultats
    results = []  # Liste pour stocker les résultats d'analyse
    log = []
    
    # Définition des catégories d'outils pour éviter les répétitions
    tool_categories = {
        "info_gathering": [],  # Liste des outils utilisés pour l'information gathering
        "enumeration": [],     # Liste des outils utilisés pour l'énumération
        "vuln_analysis": []    # Liste des outils utilisés pour l'analyse de vulnérabilités
    }

    # Phase 1 : Information Gathering (première commande)
    prompt_initial = f"""
    <s>[INST] 
    ### Mission GÉNÉRATION DE COMMANDE D'ENUMERATION
    Fournir une première commande d'Information Gathering pour la cible {target} qui soit:
    - Puissante mais non intrusive
    - Révélatrice d'informations exploitables
    - Optimisée pour Kali Linux

    ### Format STRICT (YAML uniquement)
    
    ```yaml
    tool_name: <nom_outil_spécifique>
    enumerate_command: <commande_précise_avec_paramètres_optimaux>
    install_command: <commande_installation_si_nécessaire>
    ```

    ### Contraintes CRITIQUES
    - NE Génere que une SEULE commande au format indiqué
    - NE PAS utiliser de variables génériques comme <ip>, <ip_address>, <port>, <threads> : utilisez des valeurs RÉELLES et CONCRÈTES (ex. 192.168.1.10, 10 threads, ports 80,443)
    - NE PAS rediriger la sortie vers des fichiers (--output, >, >>, tee...) : les résultats doivent s'afficher directement dans le terminal
    - NE PAS utiliser de commandes d’installation macOS (comme brew install) : uniquement apt, apt-get ou pip sur Kali Linux
    - AUCUN TEXTE en dehors du YAML
    - Commande FIABLE avec arguments VALIDES
    - JAMAIS d'outils GitHub
    - PAS de scans full-port (trop lents)
    - UNIQUEMENT des outils disponibles sur Kali
    - RESPECTEZ strictement le format demandé
    - FOCUS sur l'identification précise des services
    - PRIVILÉGIEZ les outils comme:
      * nmap avec options avancées
      * whatweb/wafw00f pour analyse web
      * fierce/amass pour DNS
      * responder/enum4linux pour Windows

    ### IMPORTANT
    - NE Génere que une commande au format indiqué
    - ASSUREZ-VOUS que tous les paramètres existent réellement
    - UTILISEZ des options documentées dans le 'man' de l'outil
    - CONCENTREZ-VOUS sur l'IDENTIFICATION des versions précises (pour CPE)
    - ÉVITEZ les arguments exotiques ou rarement utilisés
    - Evite de trop utilisé de script
    [/INST]</s>
    """  
    # Interroge llm avec le prompt initial
    response = query_llm(prompt_initial)
    print(f"[DEBUG] Réponse du llm : {response}")
    
    if not response:
        print("Impossible de communiquer avec llm ou réponse invalide.")
        exit()

    # Validation YAML de la réponse
    if not is_valid_tool_yaml(response):
        print("[ERREUR] Format YAML invalide dans la réponse. Arrêt du programme.")
        exit()
    
    response = clean_command(response)  # Nettoyage de la réponse

    # Extraction du nom de l'outil et de la commande
    yaml_data = yaml.safe_load(response)
    tool_name = yaml_data['tool_name']
    tool_categories["info_gathering"].append(tool_name)
    
    # Validation et nettoyage de la commande
    command = yaml_data['enumerate_command']
    is_valid, validated_command = validate_command(tool_name, command)
    
    if not command:
        print(f"[AVERTISSEMENT] sur la validité de la commande {validated_command}")
        # Tenter de corriger la commande
        prompt_correction = f"""
        <s>[INST]
        ### CORRECTION DE COMMANDE REQUISE
        
        La commande générée pour l'outil {tool_name} présente un problème:
        {command}
        
        Erreur détectée: {validated_command}
        
        Veuillez proposer une version CORRIGÉE de la commande qui:
        1. Utilise le même outil ({tool_name})
        2. Corrige les arguments problématiques
        3. Conserve la même fonction/objectif
        4. N'ajoute aucun argument supprime simplément les arguments erronées
        5. Fourni une seule et unique commande d'installation valide sans caractére spéciaux
        
        Répondez UNIQUEMENT avec le format YAML suivant n'ajoutez pas de texte supplémentaire:
        ```yaml
        tool_name: {tool_name}
        enumerate_command: <commande_corrigée>
        install_command: <commande_installation>
        ```
        [/INST]</s>
        """
        corrected_response = query_llm(prompt_correction)
        print(f"[DEBUG] Réponse corrigée du llm : {corrected_response}")
        
        if corrected_response and is_valid_tool_yaml(corrected_response):
            response = corrected_response
            response = clean_command(response) 
            yaml_data = yaml.safe_load(response)
            command = yaml_data['enumerate_command']
            insall_command = yaml_data['install_command']
            print(f"[INFO] Commande corrigée: {command}")
        else:
            print("[AVERTISSEMENT] Impossible de corriger la commande. Utilisation de la version originale.")
    
    # Affichage de la commande finale
    print(f"\n[COMMANDE À EXÉCUTER]: {command}")
    
    # Si une commande d'installation est fournie, l'afficher
    if 'install_command' in yaml_data and yaml_data['install_command']:
        print(f"[INSTALLATION SI NÉCESSAIRE]: {yaml_data['install_command']}")
        insall_command = yaml_data['install_command']
    
    # print("\nExécutez la commande puis collez le résultat (tapez 'END' pour terminer):")
    # lines = []
    # while True:
    #     line = input()
    #     if line == 'END':
    #         break
    #     lines.append(line)
    # result = '\n'.join(lines)
    
    if command:
        if len(command) < 150 :
            result = execute_command_docker(command)
        else :
            print("[AVERTISSEMENT] La commande est trop longue (>50 caractères).")
            result = "error : commande trop longue"
        if "not found" in result:
                print("[DEBUG] L'outil requis est absent.Tentative d'installation...")
                install_success = execute_install_docker(insall_command)
                if not install_success:
                    print(f"[ERREUR] Impossible d'installer l'outil '{tool_name}',ne plus proposer de commandes avec.")
                    history.append({"command": command, "result": f"[ERREUR] L'outil '{tool_name}' n'a pas pu être installé."})
                    
                
                # Réexécute la commande après installation
                print(f"[INFO] Réexécution de la commande après installation de l'outil '{tool_name}'.")
                result = execute_command_docker(command)

                if not result:  # Vérifie simplement si la commande a échoué (pas de "not found")
                    print(f"[ERREUR] La commande a échoué après installation de l'outil '{tool_name}'.")
                    history.append({"command": command, "result": "[ERREUR] La commande a échoué après installation de l'outil."})
        
        if  not isinstance(result, str) or "error" in result.lower() or "failed" in result.lower() or "not found" in result.lower() or result.strip() == "":
            print(f"[DEBUG] Erreur détectée dans la commande renvoie au llm pour correction")

            prompt_error = f"""
            veuillez corrigez cette commande 
            {command}
            on a eu cette erreur aprés son execution 
            {result}
            Veuillez proposer une version CORRIGÉE de la commande qui:
            1. Utilise le même outil ({tool_name})
            2. Corrige les arguments problématiques
            3. Conserve la même fonction/objectif
            4. Fourni une seule et unique commande d'installation valide sans caractére spéciaux
            5. Si la commande est supérieur a 50 charactére veuillez la modifier pour qu'elle soit plus courte
            
            Répondez UNIQUEMENT avec le format YAML suivant n'ajoutez pas de texte supplémentaire:
            ```yaml
            tool_name: {tool_name}
            enumerate_command: <commande_corrigée>
            install_command: <commande_installation>
            ```
            """
            corrected_response = query_llm(prompt_error)
            corrected_response = clean_command(corrected_response)
            print(f"[DEBUG] Réponse corrigée du llm : {corrected_response}")
            formated_response = yaml.safe_load(corrected_response)
            if formated_response and is_valid_tool_yaml(corrected_response):
                command = formated_response['enumerate_command']
                result = execute_command_docker(command)
            else :
                print("[AVERTISSEMENT] Impossible de corriger la commande. Utilisation de la version originale.")

    
    print("[DEBUG] Analyse des résultats...")
    if result:
        analyzed_result = analyze_result_with_llm(result, target, response)
        if analyzed_result:
            print("[INFO] Analyse réussie")
            print("[DEBUG] Résultat brut de l'analyse : ", analyzed_result)
            # Vérifier si l'analyse indique une erreur
            try:
                result_yaml = clean_and_analyze_result(analyzed_result)
                log.append(result_yaml)
                print("[DEBUG] Analyse de llm step 1 : ", result_yaml)
                if result_yaml :
                    if result_yaml["status"] == "ERROR":
                        error_msg = "Erreur détectée dans l'exécution de la commande"
                        if "analysis" in result_yaml and "points_d_intérêt" in result_yaml["analysis"]:
                            error_msg = result_yaml["analysis"]["points_d_intérêt"]
                        print(f"[AVERTISSEMENT] {error_msg}")
                        # Enregistrer l'erreur pour futures références
                        update_command_errors(tool_name, command, error_msg)
                    else:
                        print("[INFO] Analyse réussie, pas d'erreurs détectées.")
                        results.append(result_yaml["report_entries"])
                        results = enrich_report_with_cve(results)
                        print("[INFO] Résultats enrichis avec les CVE.", results)
            except Exception as e:
                print(f"[DEBUG] Erreur lors de la vérification du statut d'analyse: {e}")
            
            history.append({"command": response, "result": analyzed_result})
        else:
            print("[INFO] Analyse impossible. Ajout du résultat brut à l'historique.")
            history.append({"command": response, "result": result})
    else:
        print("La commande d'énumération a échoué. Vérifiez la cible ou les permissions.")
        history.append({"command": response, "result": "[ERREUR] La commande a échoué."})
        
    # Phase 2 à 10 : Prompts suivants (9 étapes)
    for step in range(1, 4):  # 10 étapes au total
        print(f"\n=== Étape {step + 1} / 10 ===")

        # Détermination de la phase actuelle basée sur l'étape
        current_phase = ""
        phase_tool_list = []
        
        if step < 2:  # Étapes 2-4: Information Gathering
            current_phase = "Information Gathering"
            phase_tool_list = tool_categories["info_gathering"]
        elif step < 3:  # Étapes 5-7: Énumération
            current_phase = "Énumération"
            phase_tool_list = tool_categories["enumeration"]
        else:  # Étapes 8-10: Analyse de vulnérabilités
            current_phase = "Analyse de vulnérabilités"
            phase_tool_list = tool_categories["vuln_analysis"]
        
        # Construction d'un résumé des découvertes précédentes
        discoveries = ""
        for entry in history:
            if "result" in entry and isinstance(entry["result"], str):
                # Extraire des informations clés des résultats précédents
                if "analysis:" in entry["result"]:
                    discoveries += entry["result"] + "\n\n"

        # Prompts de base spécifiques à chaque phase
            #         ### MATRICE D'OUTILS RECOMMANDÉS
            # | CATÉGORIE | OUTILS SUGGÉRÉS |
            # |-----------|-----------------|
            # | PASSIF | whois, recon-ng, dmitry |
            # | DNS INTEL | dig, dnsrecon, dnsenum, fierce |
            # | WEB | whatweb, wafw00f, nikto, wpscan, CMS scanners |
            # | RÉSEAU | nmap avec options de version, unicornscan, amap |
            # | SERVICES | ident-user-enum, banner grabbing, enum4linux |
            # | SNMP/SMTP/NFS | snmp-check, smtp-user-enum, showmount |
        if current_phase == "Information Gathering":
            base_prompt = f"""
            <s>[INST]
            ### MISSION Génetation d'une commande pour INFORMATION GATHERING AVANCÉ
            
            ### CIBLE
            {target}
            

            ### INTELLIGENCE COLLECTÉE et résultats des commandes précedantes
            {log}
            
            ### OBJECTIF TACTIQUE
            Générez UNE SEULE commande d'information gathering puissante qui:
            1. Explore un VECTEUR différent des précédents (web/réseau/DNS/OSINT/services)
            2. Révèle des informations SPÉCIFIQUES et EXPLOITABLES
            3. Utilise des techniques FIABLES et ÉPROUVÉES
            4. Se CONCENTRE sur l'identification précise des versions et CPE
            5. n'hésite pas à ratisser large et utiliser des outils globaux qui révéle le plus possible sur la cible
            

            
            ### FORMAT REQUIS (YAML STRICT)
            
            ```yaml
            tool_name: <nom_outil>
            enumerate_command: <commande_complète>
            install_command: <commande_installation>
            ```
            
            ### CONTRAINTES CRITIQUES
            - NE PAS utiliser de variables génériques comme <ip>, <ip_address>, <port>, <threads> : utilisez des valeurs RÉELLES et CONCRÈTES (ex. 192.168.1.10, 10 threads, ports 80,443)
            - NE PAS rediriger la sortie vers des fichiers (--output, >, >>, tee...) : les résultats doivent s'afficher directement dans le terminal
            - NE PAS utiliser de commandes d’installation macOS (comme brew install) : uniquement apt, apt-get ou pip sur Kali Linux
            - UN SEUL OUTIL à la fois
            - JAMAIS GitHub (repos Kali uniquement)
            - PARAMÈTRES précis, simples et VALIDES (vérifiables dans le man)
            - ADAPTEZ à la cible spécifique
            - PRIVILÉGIEZ l'identification précise des versions pour CPE
            - NE JAMAIS utiliser de placeholder comme <ip>, <port> : toujours une valeur réelle
            - La clé install_command DOIT contenir une commande d'installation complète comme `sudo apt-get install nmap`
            - COMMANDES INTERDITES = ['--interactive', '-i', '--verbose', '-A', 'telnet', 'ftp', 'msfconsole', 'hydra -V', 'burp-suite']
            
            Répondez UNIQUEMENT avec le bloc YAML demandé sans texte additionnel.
            [/INST]</s>
            """
            #             ### MATRICE D'OUTILS RECOMMANDÉS
            # | SERVICE | OUTILS SUGGÉRÉS |
            # |---------|-----------------|
            # | WEB | gobuster, dirsearch, nikto, wpscan, joomscan |
            # | SMB/WINDOWS | crackmapexec, smbmap, rpcclient |
            # | LINUX/UNIX | finger, rpcinfo, showmount, nfs-utils |
            # | DB | sqlmap (mode énumération), nmap scripts db-* |
            # | LDAP | ldapsearch, nmap scripts ldap-* |
            # | SMTP/POP/IMAP | smtp-user-enum, nmap scripts smtp-* |
            # | SSH | ssh-audit, nmap scripts ssh-* |
            # | FTP | nmap scripts ftp-* |
        elif current_phase == "Énumération":
            base_prompt = f"""
            <s>[INST]
            ### MISSION Génetarion d'une commande pour ÉNUMÉRATION CIBLÉE
            ### CIBLE
            {target}

            ### INTELLIGENCE COLLECTÉE
            {discoveries}
            
            ### OBJECTIF TACTIQUE
            Générez UNE SEULE commande d'énumération approfondie qui:
            1. CIBLE spécifiquement les services/ports/protocoles déjà identifiés
            2. ÉNUMÈRE précisément les configurations, versions et détails
            3. DÉCOUVRE des éléments exploitables (utilisateurs, partages, etc.)
            4. IDENTIFIE les CPE (Common Platform Enumeration) pour correspondance CVE
            

            
            ### FORMAT REQUIS (YAML STRICT)
            ```yaml
            tool_name: <nom_outil_spécifique>
            enumerate_command: <commande_complète_avec_paramètres_optimisés>
            install_command: <commande_installation_précise>
            ```
            
            ### CONTRAINTES CRITIQUES
            - NE PAS utiliser de variables génériques comme <ip>, <ip_address>, <port>, <threads> : utilisez des valeurs RÉELLES et CONCRÈTES (ex. 192.168.1.10, 10 threads, ports 80,443)
            - NE PAS rediriger la sortie vers des fichiers (--output, >, >>, tee...) : les résultats doivent s'afficher directement dans le terminal
            - NE PAS utiliser de commandes d’installation macOS (comme brew install) : uniquement apt, apt-get ou pip sur Kali Linux
            - UN SEUL OUTIL à la fois
            - JAMAIS GitHub (repos Kali uniquement)
            - PARAMÈTRES précis, simples et VALIDES (vérifiables dans le man)
            - FOCUS sur efficacité et extraction d'informations
            - ADAPTEZ à la cible spécifique et aux découvertes précédentes
            - PRIVILÉGIEZ les commandes qui révèlent des CPE
            - NE JAMAIS utiliser de placeholder comme <ip>, <port> : toujours une valeur réelle
            - La clé install_command DOIT contenir une commande d'installation complète comme `sudo apt-get install nmap`
            - COMMANDES INTERDITES = ['--interactive', '-i', '--verbose', '-A', 'telnet', 'ftp', 'msfconsole', 'hydra -V', 'burp-suite']
            
            Répondez UNIQUEMENT avec le bloc YAML demandé sans texte additionnel.
            [/INST]</s>
            """
            #             ### MATRICE D'OUTILS RECOMMANDÉS
            # | CATÉGORIE | OUTILS SUGGÉRÉS |
            # |-----------|-----------------|
            # | GÉNÉRAL | nmap, vulns |
            # | BASE DE DONNÉES | searchsploit (mode recherche uniquement) |
            # | WEB | nikto, wpscan, nuclei |
            # | SERVICES | ssl-scan, ssh-audit |
            # | WINDOWS | smb-vuln-*, crackmapexec --shares |
        else:  # Analyse de vulnérabilités
            base_prompt = f"""
            <s>[INST]
            ### MISSION Géneration d'une commande pour ANALYSE DE VULNÉRABILITÉS
            
            ### CIBLE
            {target}
            
            ### CONTEXTE OPÉRATIONNEL
            - Phase: {current_phase} (Étape {step+1}/10)
            - ne pas ustilises ses Outils déjà utilisés: {', '.join(phase_tool_list) if phase_tool_list else 'Aucun'}
            
            ### INTELLIGENCE COLLECTÉE
            {discoveries}
            
            ### OBJECTIF TACTIQUE
            Générez UNE SEULE commande d'ANALYSE DE VULNÉRABILITÉS qui:
            1. DÉTECTE les vulnérabilités dans les services identifiés
            2. IDENTIFIE les CVE potentielles basées sur les versions
            3. ESTIME le niveau de criticité des failles
            4. Se CONCENTRE sur l'identification NON INTRUSIVE (pas d'exploitation)
            
            
            ### FORMAT REQUIS (YAML STRICT)
            ```yaml
            tool_name: <nom_outil_spécifique>
            enumerate_command: <commande_avec_paramètres_optimisés>
            install_command: <commande_installation>
            ```
            
            ### CONTRAINTES CRITIQUES
            - NE PAS utiliser de variables génériques comme <ip>, <ip_address>, <port>, <threads> : utilisez des valeurs RÉELLES et CONCRÈTES (ex. 192.168.1.10, 10 threads, ports 80,443)
            - NE PAS rediriger la sortie vers des fichiers (--output, >, >>, tee...) : les résultats doivent s'afficher directement dans le terminal
            - NE PAS utiliser de commandes d’installation macOS (comme brew install) : uniquement apt, apt-get ou pip sur Kali Linux
            - UN SEUL OUTIL à la fois
            - JAMAIS GitHub (repos Kali uniquement)
            - PARAMÈTRES précis, simples et VALIDES (vérifiables dans le man)
            - UNIQUEMENT des COMMANDES DE DÉTECTION (PAS d'exploitation)
            - ADAPTEZ aux services et versions découverts
            - PRIVILÉGIEZ l'identification des CVE et scoring CVSS
            - NE JAMAIS utiliser de placeholder comme <ip>, <port> : toujours une valeur réelle
            - La clé install_command DOIT contenir une commande d'installation complète comme `sudo apt-get install nmap`
            - COMMANDES INTERDITES = ['--interactive', '-i', '--verbose', '-A', 'telnet', 'ftp', 'msfconsole', 'hydra -V', 'burp-suite', nuclei]
            
            Répondez UNIQUEMENT avec le bloc YAML demandé sans texte additionnel.
            [/INST]</s>
            """

        # Modifier le prompt en fonction des erreurs précédentes
        prompt = generate_modified_prompt(base_prompt, tool_categories, current_phase)

        # Interroger le LLM pour obtenir la prochaine commande
        response = query_llm(prompt, max_tokens_override=DEFAULT_TOKEN_LIMIT * 1.5)
        print(f"[DEBUG] Réponse du llm : {response}")
        
        # response = generate_command_validation_prompt(response, target, current_phase, results)
        # print(f"[DEBUG] Réponse du correctteur : {response}")
        
        if not response:
            print("Impossible de communiquer avec llm ou réponse invalide.")
            continue
        

        # Validation YAML et extraction des informations
        if not is_valid_tool_yaml(response):
            print("[AVERTISSEMENT] Format YAML invalide. Tentative de correction...")
            
            # Prompt pour corriger le format YAML
            fix_prompt = f"""
            <s>[INST]
            La réponse précédente n'était pas un YAML valide ou était incomplète. 
            
            Voici la réponse problématique:
            ```
            {response}
            ```
            
            Veuillez fournir une réponse CORRECTEMENT FORMATÉE
            ### FORMAT REQUIS (YAML STRICT)
            ```yaml
            tool_name: <nom_outil_spécifique>
            enumerate_command: <commande_avec_paramètres_optimisés>
            install_command: <commande_installation>
            ```
            
            ### CONTRAINTES CRITIQUES
            - NE PAS utiliser de variables génériques comme <ip>, <ip_address>, <port>, <threads> : utilisez des valeurs RÉELLES et CONCRÈTES (ex. 192.168.1.10, 10 threads, ports 80,443)
            - NE PAS rediriger la sortie vers des fichiers (--output, >, >>, tee...) : les résultats doivent s'afficher directement dans le terminal
            - NE PAS utiliser de commandes d’installation macOS (comme brew install) : uniquement apt, apt-get ou pip sur Kali Linux
            - UN SEUL OUTIL à la fois
            - JAMAIS GitHub (repos Kali uniquement)
            - PARAMÈTRES précis, simples et VALIDES (vérifiables dans le man)
            - UNIQUEMENT des COMMANDES DE DÉTECTION (PAS d'exploitation)
            - ADAPTEZ aux services et versions découverts
            - JAMAIS d'outil déjà utilisé: {', '.join(phase_tool_list) if phase_tool_list else 'N/A'}
            - PRIVILÉGIEZ l'identification des CVE et scoring CVSS
            - NE JAMAIS utiliser de placeholder comme <ip>, <port> : toujours une valeur réelle
            - La clé install_command DOIT contenir une commande d'installation complète comme `sudo apt-get install nmap`
            - COMMANDES INTERDITES = ['--interactive', '-i', '--verbose', '-A', 'telnet', 'ftp', 'msfconsole', 'hydra -V', 'burp-suite']
            
            [/INST]</s>
            """
            
            response = query_llm(fix_prompt)
            if not is_valid_tool_yaml(response):
                print("[ERREUR] Impossible de générer un YAML valide. Passons à l'étape suivante.")
                continue
        response = clean_command(response)  # Nettoyage de la réponse
        # Extraction du nom de l'outil et de la commande
        yaml_data = yaml.safe_load(response)
        tool_name = yaml_data['tool_name']
        command = yaml_data['enumerate_command']
        
        # Vérifier si c'est un doublon
        if is_duplicate_command(command, history):
            print("[AVERTISSEMENT] Cette commande est similaire à une commande précédente. Génération d'une alternative...")
            
            # Prompt pour générer une commande alternative
            alt_prompt = f"""
            <s>[INST]
            La commande suivante est similaire à une commande déjà exécutée:
            
            ```
            {command}
            ```
            
            Veuillez générer une COMMANDE ALTERNATIVE qui:
            1. Utilise un OUTIL DIFFÉRENT 
            2. Explore un AUTRE ASPECT de la cible
            3. Génère des INFORMATIONS COMPLÉMENTAIRES
            4. Évite toute similarité avec la commande précédente
            
            Outils déjà utilisés: {', '.join(phase_tool_list) if phase_tool_list else 'Aucun'}
            
            Réponse strict avec le bloc YAML.
            ```yaml
            tool_name: <nom_outil_spécifique>
            enumerate_command: <commande_complète_avec_paramètres_optimisés>
            install_command: <commande_installation_précise>
            ```
            [/INST]</s>
            """
            
            response = query_llm(alt_prompt)
            if is_valid_tool_yaml(response):
                response = clean_command(response)  # Nettoyage de la réponse
                yaml_data = yaml.safe_load(response)
                tool_name = yaml_data['tool_name']
                command = yaml_data['enumerate_command']
                print(f"[INFO] Commande alternative générée: {command}")
            else:
                print("[ERREUR] Impossible de générer une commande alternative valide.")
                continue
        
        # Ajouter l'outil à la catégorie appropriée
        if current_phase == "Information Gathering":
            tool_categories["info_gathering"].append(tool_name)
        elif current_phase == "Énumération":
            tool_categories["enumeration"].append(tool_name)
        else:
            tool_categories["vuln_analysis"].append(tool_name)
            
        # Validation et nettoyage de la commande
        is_valid, validated_command = validate_command(tool_name, command)
        if not is_valid:
            print(f"[AVERTISSEMENT] {validated_command}")
            
            # Tenter de corriger la commande
            prompt_correction = f"""
            <s>[INST]
            ### CORRECTION DE COMMANDE REQUISE
            
            La commande générée pour l'outil {tool_name} présente un problème:
            
            ```
            {command}
            ```
            
            Erreur détectée: {validated_command}
            
            Veuillez proposer une version CORRIGÉE de la commande qui:
            1. Utilise le même outil ({tool_name})
            2. Corrige les arguments problématiques
            3. Conserve la même fonction/objectif
            4. N'ajoute aucun argument supprime simplément les arguments erronées
            5. Fourni une seule et unique commande d'installation valide sans caractére spéciaux
            
            Répondez UNIQUEMENT avec le format YAML suivant.
            ```yaml
            tool_name: {tool_name}
            enumerate_command: <commande_corrigée>
            install_command: <commande_installation>
            ```
            [/INST]</s>
            """
            
            corrected_response = query_llm(prompt_correction)
            if corrected_response and is_valid_tool_yaml(corrected_response):
                response = corrected_response
                response = clean_command(response)  # Nettoyage de la réponse
                yaml_data = yaml.safe_load(response)
                command = yaml_data['enumerate_command']
                
                print(f"[INFO] Commande corrigée: {command}")
            else:
                print("[AVERTISSEMENT] Impossible de corriger la commande. Utilisation de la version originale.")

        # Affichage de la commande finale
        print(f"\n[COMMANDE À EXÉCUTER]: {command}")
        
        # Si une commande d'installation est fournie, l'afficher
        if 'install_command' in yaml_data and yaml_data['install_command']:
            insall_command = yaml_data['install_command']
            print(f"[INSTALLATION SI NÉCESSAIRE]: {yaml_data['install_command']}")
            
        # print("\nExécutez la commande puis collez le résultat (tapez 'END' pour terminer):")
        # lines = []
        # while True:
        #     line = input()
        #     if line == 'END':
        #         break
        #     lines.append(line)
        # result = '\n'.join(lines)
        
        if command:
            if len(command) < 150 :
                result = execute_command_docker(command)
            else :
                print("[AVERTISSEMENT] La commande est trop longue (>50 caractères).")
                result = "error : commande trop longue"
            if isinstance(result, str) and "not found" in result.lower(): 
                    print("[DEBUG] L'outil requis est absent.Tentative d'installation...")
                    install_success = execute_install_docker(insall_command)
                    if not install_success:
                        print(f"[ERREUR] Impossible d'installer l'outil '{tool_name}',ne plus proposer de commandes avec.")
                        history.append({"command": command, "result": f"[ERREUR] L'outil '{tool_name}' n'a pas pu être installé."})
                        
                    
                    # Réexécute la commande après installation
                    print(f"[INFO] Réexécution de la commande après installation de l'outil '{tool_name}'.")
                    result = execute_command_docker(command)

                    if not result:  # Vérifie simplement si la commande a échoué (pas de "not found")
                        print(f"[ERREUR] La commande a échoué après installation de l'outil '{tool_name}'.")
                        history.append({"command": command, "result": "[ERREUR] La commande a échoué après installation de l'outil."})
            if  not isinstance(result, str) or "error" in result.lower() or "failed" in result.lower() or "not found" in result.lower() or result.strip() == "":
                MAX_RETRIES = 2
                retry_count = 0

                while (
                    not isinstance(result, str)
                    or "error" in result.lower()
                    or "failed" in result.lower()
                    or "not found" in result.lower()
                    or result.strip() == ""
                ) and retry_count < MAX_RETRIES:

                    print(f"[DEBUG] Erreur détectée dans la commande. Tentative de correction #{retry_count + 1}.")

                    prompt_error = f"""
                    veuillez corriger cette commande :
                    {command}

                    Voici l'erreur retournée après exécution :
                    {result}

                    Veuillez proposer une version CORRIGÉE de la commande qui :
                    1. Utilise le même outil ({tool_name})
                    2. Corrige les arguments problématiques
                    3. Conserve la même fonction/objectif
                    4. Fournit une seule et unique commande d'installation valide sans caractères spéciaux

                    Répondez UNIQUEMENT avec le format YAML suivant, sans aucun texte supplémentaire :
                    ```yaml
                    tool_name: {tool_name}
                    enumerate_command: <commande_corrigée>
                    install_command: <commande_installation>
                    ```
                    """

                    corrected_response = query_llm(prompt_error)
                    corrected_response = clean_command(corrected_response)
                    print(f"[DEBUG] Réponse corrigée du LLM :\n{corrected_response}")

                    try:
                        formated_response = yaml.safe_load(corrected_response)
                        if formated_response and is_valid_tool_yaml(corrected_response):
                            command = formated_response['enumerate_command']
                            result = execute_command_docker(command)
                        else:
                            print("[AVERTISSEMENT] Format YAML invalide. Tentative suivante...")
                            result = "error : YAML invalide"
                    except Exception as e:
                        print(f"[ERREUR] Exception YAML : {e}")
                        result = "error : exception de parsing"

                    retry_count += 1

                        
        print("[DEBUG] Analyse des résultats...")
        if result:
            analyzed_result = analyze_result_with_llm(result, target, response)
            if analyzed_result:
                print("[INFO] Analyse réussie")
                print("[DEBUG] Résultat brut de l'analyse : ", analyzed_result)
                
                # Vérifier si l'analyse indique une erreur
                try:
                    print("[DEBUG] Analyse du statut de la commande...", analyzed_result)
                    result_yaml = clean_and_analyze_result(analyzed_result)
                    log.append(result_yaml)
                    print("[DEBUG] Analyse de llm step 234... : ", result_yaml)
                    if result_yaml :
                        if result_yaml["status"] == "ERROR":
                            error_msg = "Erreur détectée dans l'exécution de la commande"
                            if "analysis" in result_yaml and "points_d_intérêt" in result_yaml["analysis"]:
                                error_msg = result_yaml["analysis"]["points_d_intérêt"]
                            
                            print(f"[AVERTISSEMENT] {error_msg}")
                            # Enregistrer l'erreur pour futures références
                            update_command_errors(tool_name, command, error_msg)
                        else:
                            print("[INFO] Analyse réussie, pas d'erreurs détectées.")
                            results.append(result_yaml["report_entries"])
                            results = enrich_report_with_cve(results)
                            print("[INFO] Résultats enrichis avec les CVE.", results)
                except Exception as e:
                    print(f"[DEBUG] Erreur lors de la vérification du statut d'analyse: {e}")
                
                history.append({"command": response, "result": analyzed_result})
            else:
                print("[INFO] Analyse impossible. Ajout du résultat brut à l'historique.")
                history.append({"command": response, "result": result})
        else:
            print("La commande d'énumération a échoué. Vérifiez la cible ou les permissions.")
            history.append({"command": response, "result": "[ERREUR] La commande a échoué."})
            continue

    # Construction du résumé complet des découvertes pour le rapport final
    findings_summary = ""
    for i, entry in enumerate(history):
        try:
            if isinstance(entry["command"], str) and entry["command"] == "CPE-CVE Correlation":
                findings_summary += f"### Correspondance CPE-CVE\n\n"
                findings_summary += f"**Résultats**:\n{entry['result']}\n\n"
                continue
                
            yaml_data = yaml.safe_load(entry["command"])
            tool_name = yaml_data.get('tool_name', 'Outil inconnu')
            command = yaml_data.get('enumerate_command', 'Commande inconnue')
            findings_summary += f"### Étape {i+1}: {tool_name}\n\n"
            findings_summary += f"**Commande**: `{command}`\n\n"
            findings_summary += f"**Résultats**:\n{entry['result']}\n\n"
        except Exception as e:
            findings_summary += f"### Étape {i+1}: (Erreur de parsing)\n\n"
            findings_summary += f"**Commande**: {entry['command']}\n\n"
            findings_summary += f"**Résultats**: {entry['result']}\n\n"

    prompt_remarks = f"""
    <s>[INST]
    ### MISSION : REMARQUE DE SYNTHÈSE POUR RAPPORT DE PENTEST

    ### CONTEXTE
    - Cible testée : {target}
    - Résultats obtenus :
    {findings_summary}

    ### OBJECTIF
    Rédigez un **bref paragraphe clair et professionnel** qui :
    - Résume l’ensemble du pentest (reconnaissance, énumération, vulnérabilités)
    - Mentionne le **niveau de risque global** estimé
    - Identifie le **nombre de services exposés et vulnérabilités critiques**
    - Conclut avec une **recommandation stratégique générale**

    ### CONTRAINTES
    - Une seule remarque (max 5 lignes)
    - PAS de détails techniques, PAS de blabla
    - Langage clair, synthétique et orienté RSSI
    - Ton neutre, professionnel, sans alarmisme inutile
    [/INST]</s>
    """

    print(f"\n=== Rapport Final d'Identification de Vulnérabilités ===\n")
    remarks = query_llm(prompt_remarks, max_tokens_override=REPORT_TOKEN_LIMIT)
    if not remarks:
        print("Impossible de générer le rapport. Vérifiez la communication avec llm.")
        return
    
    template_data = {
    "project_title": "Rapport d'énumération automatisée",
    "project_name": "usthb",
    "scan_id": "001",
    "target": target,  # Variable existante
    "date": datetime.now().strftime("%d/%m/%Y"),
    "results": flat_results,  # Variable existante
    "remarks": remarks  # Variable existante
    }
    
    path_to_wkhtmltopdf = "/root/Pentral/wkhtmltopdf/bin/wkhtmltopdf.exe"
    config = pdfkit.configuration(wkhtmltopdf=path_to_wkhtmltopdf)
    env = Environment(loader=FileSystemLoader('/root/Pentral/rapportpfe/rapportpfe'))
    template = env.get_template('rapport_template.html')
    
    # Aplatir la liste si elle est imbriquée
    flat_results = [entry for group in results if isinstance(group, list) for entry in group if isinstance(entry, dict)]

    html_content = template.render(
        project_title="Rapport d'énumération automatisée",
        project_name="usthb",
        scan_id="001",
        target_ip=target,
        date=datetime.now().strftime("%d/%m/%Y"),
        results=flat_results,
        remarks=remarks
    )

    

    output_pdf = "/root/Pentral/rapportpfe/rapport_final.pdf"
    options = {
        'enable-local-file-access': None,
        'footer-right': '[page]/[topage]',
        'footer-font-size': '8',
        'footer-spacing': '5',
    }

    pdfkit.from_string(html_content, output_pdf, configuration=config, options=options)
    print("\n✅ Rapport PDF généré avec succès : rapport_final.pdf")

    # Sauvegarde de l'historique des commandes pour référence future
    command_history = load_command_history()
    for entry in history:
        if "command" in entry and isinstance(entry["command"], str):
            try:
                yaml_data = yaml.safe_load(entry["command"])
                if yaml_data and "enumerate_command" in yaml_data:
                    command_entry = {
                        "tool": yaml_data.get("tool_name", "unknown"),
                        "command": yaml_data["enumerate_command"],
                        "timestamp": time.time()
                    }
                    command_history["commands"].append(command_entry)
            except Exception:
                pass
    
    save_command_history(command_history)
    print("\n[INFO] Historique des commandes sauvegardé pour amélioration continue.")

if __name__ == "__main__":
    main()