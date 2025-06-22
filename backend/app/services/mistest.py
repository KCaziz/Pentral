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
import sys
sys.path.insert(0, "/root/nvdlib")

# Base de données locale pour suivre les commandes déjà exécutées
COMMAND_HISTORY_FILE = "command_history.json"
# Base de données locale pour la validation des commandes
COMMAND_VALIDATION_FILE = "command_validation.json"
# Constantes de configuration
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TOKEN_LIMIT = 800  # Augmenté par défaut
ANALYSIS_TOKEN_LIMIT = 800
REPORT_TOKEN_LIMIT = 800

def clean_recommendation_block(block: str) -> str:
    """
    Supprime les indentations excessives ligne par ligne,
    y compris la première ligne.
    """
    lines = block.splitlines()
    cleaned = [line.lstrip() for line in lines]
    return "\n".join(cleaned)

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
            "temperature": 0.2, 
            "top_p": 0.9,
            "max_tokens": int(max_tokens),
            "stream": False,
            "echo": False
        }
        
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
            ["docker", "exec", "-i", container_name, "bash", "-c", f"man {tool} 2>/dev/null || {tool} --help 2>&1 || {tool} -h 2>&1"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10
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
    #print(f"[DEBUG] historique: {history}")
    
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
        if not isinstance(raw_result, str) or any(
            kw in raw_result.lower() for kw in ["error", "usage:", "command not found", "failed"]
        ):
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
        - nom: <nom_service>
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
        
        # Nettoyage des caractères échappés (\_ → _)
        response = response.replace("\\_", "_")

        # Corrige éventuellement les réponses génériques non remplacées
        if "<ip_address>" in response:
            response = response.replace("<ip_address>", target)
            
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
    
    if problematic_args:
        warning_block += f"- ÉVITER ces arguments problématiques: {', '.join(problematic_args)}\n"
    
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

import nvdlib
from typing import List
import time

# Mapping technologie → (vendor, product) connu dans NVD
CPE_MAP = {
    "ftp": ("vsftpd", "vsftpd"),
    "http": ("apache", "http_server"),
    "ssh": ("openbsd", "openssh"),
    "domain": ("isc", "bind"),
    "smtp": ("postfix", "postfix"),
    "telnet": ("gnu", "inetutils"),
    "exec": ("netkit", "netkit"),
    "login?": ("gnu", "inetutils"),
    "rpcbind": ("rpcbind", "rpcbind"),
    "netbios-ssn": ("samba", "samba"),
}

def guess_and_validate_cpe(technologie: str, version: str, api_key: str = None) -> list[str]:
    """
    Génère des CPE candidats à partir du mapping et teste leur existence réelle
    dans le dictionnaire officiel NVD (même sans CVE).
    Retourne uniquement ceux qui existent officiellement (CPE valides).
    """
    base_url = "https://services.nvd.nist.gov/rest/json/cpes/2.0"
    headers = {"apiKey": api_key} if api_key else {}

    produit = technologie.lower().strip()
    version = version.strip()

    # Vérification préalable : techno connue ?
    if produit not in CPE_MAP:
        print(f"[WARN] 🚫 Technologique inconnue pour CPE → pas de génération automatique : {produit}")
        return []

    # Vérification préalable : version raisonnable ?
    if version.lower() in {"", "—", "n/a", "non identifié", "unknown"}:
        print(f"[WARN] 🚫 Version insuffisante pour deviner un CPE pour {produit}")
        return []

    vendor, product = CPE_MAP.get(produit, (produit, produit))

    # Extraction de variantes de version
    version_parts = re.findall(r'\d+(?:\.\d+)*', version)
    version_variants = []
    if version_parts:
        v_full = version_parts[0]  # ex: 2.2.8
        version_variants.append(v_full)
        if "." in v_full:
            version_variants.append(".".join(v_full.split(".")[:-1]))  # ex: 2.2
            version_variants.append(v_full.split(".")[0])  # ex: 2
    version_variants.append("")  # fallback générique

    valid_cpes = []
    print(f"[DEBUG] 🔍 Tentatives de validation de CPE pour {technologie} {version}...")

    for v in version_variants:
        cpe = f"cpe:/a:{vendor}:{product}:{v}" if v else f"cpe:/a:{vendor}:{product}"
        if "cpe:/a::" in cpe:
            continue  # protection contre mauvaise interpolation

        print(f"[TEST] ⏳ Vérification de l’existence de : {cpe}")

        try:
            params = {"cpeMatchString": convert_to_cpe23(cpe), "resultsPerPage": 1}
            response = requests.get(base_url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()

            if data.get("totalResults", 0) > 0:
                print(f"[OK] ✅ CPE valide trouvé dans la base : {cpe}")
                valid_cpes.append(cpe)
            else:
                print(f"[FAIL] ❌ CPE inexistant dans le dictionnaire NVD : {cpe}")
        except Exception as e:
            print(f"[ERREUR] ❌ Erreur HTTP lors de la vérification de {cpe} : {e}")

    return valid_cpes
    
def convert_to_cpe23(cpe_uri: str) -> str:
    if not cpe_uri.startswith("cpe:/"):
        return cpe_uri
    parts = cpe_uri[5:].split(":")
    if len(parts) < 3:
        return None
    part = parts[0]
    vendor = parts[1]
    product = parts[2]
    version = parts[3] if len(parts) > 3 else "*"
    fields = [part, vendor, product, version] + ["*"] * (10 - 4)
    return "cpe:2.3:" + ":".join(fields)

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
                    "criticite": "Basse"
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
                        cve_info[cve_id] = severity

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
                cve_tri = sorted(cve_info.items(), key=lambda x: severite_order.get(x[1], 0), reverse=True)
                top_3 = [cve for cve, _ in cve_tri[:3]]
                print(f"[RESULT] ✅ CVEs sélectionnées pour {technologie} : {', '.join(top_3)}")
                entry.update({
                    "vulnerable": True,
                    "cve": ", ".join(top_3),
                    "criticite": criticite
                })
            else:
                print(f"[RESULT] 🚫 Aucune CVE pertinente trouvée pour {technologie}")
                entry.update({
                    "vulnerable": False,
                    "cve": "—",
                    "criticite": "Basse"
                })

    return results_nested

def remove_duplicates_keep_best(entries: List[dict]) -> List[dict]:
    from collections import defaultdict

    # Ordre de priorité pour les criticités (français)
    criticity_rank = {
        "HAUTE": 3,
        "MOYENNE": 2,
        "BASSE": 1
    }

    # Valeurs considérées comme "non renseignées"
    UNSET_VALUES = {"", "—", "N/A", "NON RENSEIGNÉ", "NON_RENSEIGNÉ", "AUCUNE", None}

    grouped = defaultdict(list)

    # Regrouper les services par port
    for entry in entries:
        port = entry.get("port")
        if port is not None:
            grouped[port].append(entry)

    best_entries = []

    for port, group in grouped.items():
        # Étape 1 : prioriser ceux avec CVE présente
        with_cve = [
            e for e in group
            if str(e.get("cve", "")).strip().upper() not in UNSET_VALUES
        ]

        if with_cve:
            best = max(
                with_cve,
                key=lambda e: criticity_rank.get(str(e.get("criticite", "")).strip().upper(), 0)
            )
            best_entries.append(best)
            continue

        # Étape 2 : sinon, choisir l’entrée la plus complète (techno + version)
        def completeness_score(e):
            score = 0
            tech = str(e.get("technologie", "")).strip().upper()
            ver = str(e.get("version", "")).strip().upper()
            if tech not in UNSET_VALUES:
                score += 1
            if ver not in UNSET_VALUES:
                score += 1
            return score

        best = max(group, key=completeness_score)
        best_entries.append(best)

    return best_entries


def execute_command_docker(command, container_name="kali-pentest"):
    """
    Exécute une commande Linux dans un conteneur Docker.
    Gère les cas de sortie vide, erreur système, ou succès normal.
    """
    try:
        full_command = command.replace("sudo ", "", 1).replace("`", "").strip()
        full_command = full_command.replace("`", "").strip()
        print(f"[DEBUG] Commande complète à exécuter : {full_command}")

        result = subprocess.run(
            [full_command],
            capture_output=True,
            text=True,
            shell=True
        )
        stdout = result.stdout.strip()
        # 🔍 Filtrage des lignes parasites de l'environnement Exegol
        noise_filters = [
            "Your version of Exegol wrapper is not up-to-date!",
            "bash: cannot set terminal process group",
            "inappropriate ioctl",
            "no job control",
            "bash: no job control in this shell"
        ]

        # Supprime les lignes parasites du stdout

        stdout = "\n".join([
            line for line in result.stdout.splitlines()
            if all(noise.lower() not in line.lower() for noise in noise_filters)
        ]).strip()


        stderr = "\n".join([
            line for line in result.stderr.splitlines()
            if all(noise not in line.lower() for noise in noise_filters)
        ]).strip()

        code = result.returncode

        #print("Résultat :")
        print("Résultat :", flush=True)
        print(stdout if stdout else "[VIDE]", flush=True)

        if stderr:
            print(f"[DEBUG] STDERR : {stderr}")
        print(f"[DEBUG] Code retour : {code}")

        # Cas 1 : Erreur système réelle (commande inconnue, invalid flag...)
        if code != 0 and any(err in stderr.lower() for err in ["not found", "invalid", "error", "failed"]):
            return f"[ERREUR] {stderr}"

        # Cas 2 : Exécution correcte mais sans résultats
        if code == 1 and stdout == "" and stderr == "":
            return "[VIDE]"
        
        # Cas 2bis : Succès mais sans aucune sortie
        if code == 0 and stdout == "" and stderr == "":
            return "[VIDE]"

        if code == 0 and not stdout and not stderr:
            print("[DEBUG] ⚠️ Commande exécutée avec succès mais sans aucune sortie.")
            return "[VIDE]"


        # Cas 3 : Succès avec sortie
        return stdout if stdout else stderr

    except Exception as e:
        print(f"[DEBUG] Erreur générale lors de l'exécution : {e}")
        return f"[EXCEPTION] {str(e)}"

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


import ast
import re

def extract_open_ports(result: str) -> List[int]:
    """
    Extrait tous les ports TCP ouverts à partir d'un résultat brut de Nmap -sS.
    """
    open_ports = []
    for line in result.splitlines():
        match = re.match(r"^(\d+)/tcp\s+open", line)
        if match:
            port = int(match.group(1))
            open_ports.append(port)
    return open_ports

def parse_nmap_services_and_cpes(output: str) -> list[dict]:
    """
    Parse la sortie d’un scan `nmap -sV --script vulners`.
    Associe chaque port/service détecté à ses CPEs (s’il y en a).
    Retourne une liste d’entrées :
    {
        "port": 80,
        "technologie": "http",
        "version": "Apache httpd 2.2.8",
        "cpes": ["cpe:/a:apache:http_server:2.2.8", ...]
    }
    """
    entries = []
    current_entry = None

    for line in output.splitlines():
        line = line.strip()
        
        # Détection d’un nouveau service
        if re.match(r'^[0-9]+/tcp\s+open\s+\S+', line):
            print("dedqns ")
            if current_entry:
                entries.append(current_entry)
                
            parts = line.split()
            try:
                port = int(parts[0].split('/')[0])
                tech = parts[2]
                version = " ".join(parts[3:]) if len(parts) > 3 else "N/A"
                current_entry = {
                    "port": port,
                    "technologie": tech,
                    "version": version.strip() or "N/A",
                    "cpes": []
                }
                print("entreeeee ",current_entry)
            except Exception:
                current_entry = None

        # Détection et nettoyage des CPEs
        elif "cpe:/" in line and current_entry:
            raw_matches = re.findall(r'cpe:/[^\s\'",)]+', line)
            cleaned = [cpe.rstrip(":") for cpe in raw_matches]
            current_entry["cpes"].extend(cleaned)

    if current_entry:
        print("entreeeee ",current_entry)
        entries.append(current_entry)

    return entries

def phase1_initiale(target):
    print("\n=== PHASE 1 : SCAN INITIAL (sS + sV) ===")
    history = []

    command =  f"nmap -sS -Pn -T4 --max-retries 1 --host-timeout 90s --min-rate 100 -p1-1000 {target}"
    #timeout -- T5  -O     max-retries sous domaines 
    install_cmd= "apt install nmap -y"

    print(f"[INFO] Exécution de : {command}")
    result = execute_command_docker(command)

    if "not found" in result.lower():
        print("[INFO] Installation de l'outil manquant...")
        execute_install_docker(install_cmd)
        result = execute_command_docker(command)

    if not result:
        print("[ERREUR] Le scan -sS a échoué.")
        history.append({
            "command": {
                "tool_name": "nmap",
                "enumerate_command": command,
                "install_command": "apt install nmap -y"
            },
            "result": "[ERREUR] Échec d'exécution."
        })
        return [], [],history

    open_ports = extract_open_ports(result)

    print("[INFO] Ports ouverts détectés :", open_ports)

    if not open_ports:
        print("[INFO] Aucun port ouvert. Fin de phase 1, passage à la phase 2.")
        return [], [],history   # pas d’analyse ni d’entrée log, mais history est bien rempli



    ports_str = ",".join(map(str, open_ports))
    sV_command = f"nmap -sV --script vulners -Pn -T4 -p{ports_str} {target}"
    print(f"[INFO] Scan -sV avec vulners : {sV_command}")
    result_vulners = execute_command_docker(sV_command)

    if not result_vulners:
        print("[ERREUR] Le scan -sV --script vulners a échoué.")
        history.append({
            "command": {
                "tool_name": "nmap",
                "enumerate_command": sV_command,
                "install_command": "apt install nmap -y"
            },
            "result": "[ERREUR] Échec d'exécution."
        })
        return [], [], history
        
    entries = parse_nmap_services_and_cpes(result_vulners)
    print(f"[DEBUG] Services extraits : {entries}")

    enriched = enrich_report_with_cve([entries])
    print("[DEBUG] Résultats enrichis :", enriched)

    # enriched est de type [[ {...}, {...} ]]
    if enriched and isinstance(enriched[0], list):
        results = enriched[0]  # on récupère la seule vraie liste de services
    else:
        results = enriched  # fallback au cas où le format change

    print("results :", results)

    history.append({"command": sV_command, "result": result_vulners})
    return results, [
        {
            "tool_name": "nmap",
            "status": "SUCCESS",
            "report_entries": results
        }
    ], history
    #return [],[],[]

def is_service_incomplete(service: Dict, history: List[Dict]) -> bool:
    tech = service.get("technologie", "").lower()
    port = str(service.get("port", ""))
    cve = service.get("cve", "—").strip().lower()
    cpes = service.get("cpes", []) if isinstance(service.get("cpes", []), list) else []

    # 1. Déjà complet ? → ignorer
    if cve not in {"", "—", "aucune", "n/a"}:
        print(f"[SKIP] {tech}:{port} ignoré : CVE déjà détectée → {cve}")
        return False
    if any(cpe.strip().lower() not in {"", "—", "n/a"} for cpe in cpes):
        print(f"[SKIP] {tech}:{port} ignoré : CPE déjà détecté → {cpes}")
        return False

    # 2. Technos trop bas niveau
    techno_bas_niveau = {"rpcbind", "netbios-ssn", "mdns", "ipp", "printer", "microsoft-ds"}
    if tech in techno_bas_niveau:
        print(f"[SKIP] {tech}:{port} ignoré : service système de bas niveau")
        return False

    # 3. Vérifie si un outil autorisé a déjà été testé
    tool_map = {
        "ftp": {
            "ok": [
                "nmap --script ftp-anon",
                "nmap --script ftp-bounce",
                "nmap --script ftp-syst",
                "echo | nc {target} 21"
            ],
            "ban": ["enum4linux", "smbclient", "rpcclient", "http", "ssh", "telnet"]
        },
        "http": {
            "ok": [
                "whatweb {target}",
                "curl -I http://{target}",
                "nmap --script http-title -p 80 {target}"
            ],
            "ban": ["ftp", "ssh", "enum4linux", "telnet", "smtp"]
        },
        "https": {
            "ok": [
                "curl -Ik https://{target}",
                "nmap --script ssl-cert -p 443 {target}",
                "nmap --script ssl-enum-ciphers -p 443 {target}"
            ],
            "ban": ["ftp", "rpcclient", "smbclient", "telnet"]
        },
        "smtp": {
            "ok": [
                "openssl s_client -connect {target}:25 -starttls smtp",
                "nmap --script smtp-commands -p 25 {target}"
            ],
            "ban": ["ftp", "telnet", "http", "rpcclient"]
        },
        "smb": {
            "ok": [
                "enum4linux -a {target}",
                "smbclient -L {target} -N",
                "rpcclient -U '' {target} -c 'enumdomusers'"
            ],
            "ban": ["ftp", "http", "curl", "ssh", "snmp"]
        },
        "snmp": {
            "ok": [
                "snmpwalk -v2c -c public {target}",
                "snmp-check {target}",
                "nmap --script snmp-info -p 161 {target}"
            ],
            "ban": ["ftp", "ssh", "http", "rpcclient"]
        },
        "ssh": {
            "ok": [
                "ssh -v {target}",
                "nmap --script ssh2-enum-algos -p 22 {target}",
                "nmap --script ssh-hostkey -p 22 {target}"
            ],
            "ban": ["ftp", "http", "rpcclient", "smbclient"]
        },
        "domain": {
            "ok": [
                "dig {target}",
                "nslookup {target}",
                "nmap --script dns-recursion {target}",
                "nmap --script dns-nsid {target}"
            ],
            "ban": ["ftp", "ssh", "http", "smbclient"]
        },
        "telnet": {
            "ok": [
                "echo | nc {target} 23",
                "nmap --script telnet-encryption -p 23 {target}"
            ],
            "ban": ["ftp", "ssh", "enum4linux", "http"]
        },
        "rpcbind": {
            "ok": [
                "rpcinfo -p {target}",
                "nmap --script rpcinfo -p 111 {target}"
            ],
            "ban": ["ftp", "ssh", "http", "enum4linux"]
        },
        "exec": {
            "ok": [
                "nmap --script rsh-rexec -p 512 {target}",
                "rusers {target}"
            ],
            "ban": ["ftp", "ssh", "smbclient", "http", "rpcclient"]
        },
        "login?": {
            "ok": [
                "nmap --script rusers -p 513 {target}",
                "finger {target}"
            ],
            "ban": ["ftp", "http", "rpcclient", "ssh"]
        }
    }

    outils_autorises = tool_map.get(tech, {}).get("ok", [])

    for entry in history:
        cmd = entry.get("command", {})
        command_str = cmd.get("enumerate_command", "") if isinstance(cmd, dict) else str(cmd)

        if str(port) not in command_str:
            continue  # on ne considère que les commandes ciblant ce port

        for outil in outils_autorises:
            outil_base = outil.split()[0].lower()
            outil_lower = outil.lower()

            if outil_base != "nmap":
                if outil_base in command_str.lower():
                    print(f"[SKIP] {tech}:{port} ignoré : déjà scanné avec {outil_base}")
                    return False
            else:
                if "--script" in outil_lower:
                    try:
                        scripts = outil_lower.split("--script", 1)[1].strip().split(",")
                        if all(script.strip() in command_str.lower() for script in scripts):
                            print(f"[SKIP] {tech}:{port} ignoré : nmap déjà exécuté avec {scripts}")
                            return False
                    except IndexError:
                        continue  # ignore si mal formaté

    # 4. Vérification de la précision de version
    version = service.get("version", "").lower()
    if version in {"", "—", "n/a", "unknown"}:
        print(f"[ADD] {tech}:{port} ajouté : aucune version détectée")
        return True
    num_parts = re.findall(r"\d+", version)
    if len(num_parts) < 3:
        print(f"[ADD] {tech}:{port} ajouté : version trop vague → {version}")
        return True

    print(f"[SKIP] {tech}:{port} ignoré : version déjà assez précise → {version}")
    return False


def extract_incomplete_services_structured(results: List[Dict], history: List[Dict]) -> List[Dict]:
    """
    Retourne une liste de services (dicts) incomplets à explorer.
    Contrairement à la version originale, elle renvoie les objets complets, pas juste des lignes formatées.
    """
    incomplets = []
    for service in results:
        if not isinstance(service, dict):
            continue
        if is_service_incomplete(service, history):
            incomplets.append(service)
    return incomplets

    
def extract_executed_commands_checked(history: List[Dict]) -> List[Dict]:
    summary = []
    seen = set()

    for entry in history:
        cmd = entry.get("command")
        result = entry.get("result")

        tool = "outil inconnu"
        cmd_str = "commande inconnue"

        # 🧼 1. Nettoyer et parser la commande
        if isinstance(cmd, str):
            try:
                parsed = yaml.safe_load(cmd)
                if isinstance(parsed, dict):
                    tool = parsed.get("tool_name", tool)
                    cmd_str = parsed.get("enumerate_command", cmd_str)
                elif isinstance(parsed, str):
                    cmd_str = parsed
                    if "nmap" in cmd_str.lower():
                        tool = "nmap"
            except Exception:
                cmd_str = cmd.strip()
                if "nmap" in cmd_str.lower():
                    tool = "nmap"

        elif isinstance(cmd, dict):
            tool = cmd.get("tool_name", tool)
            cmd_str = cmd.get("enumerate_command", cmd_str)

        # ❌ Si on n’a rien de cohérent, on saute
        if not cmd_str or not tool:
            continue

        # ✅ Éviter doublons
        key = (tool.strip().lower(), cmd_str.strip().lower())
        if key in seen:
            continue
        seen.add(key)

        # 🧠 2. Déterminer le statut de la commande
        if isinstance(result, dict) and "status" in result:
            status = "SUCCESS" if result["status"] == "SUCCESS" else "ERROR"
        elif isinstance(result, str):
            lower = result.lower()
            if any(word in lower for word in ["error", "fail", "not found"]):
                status = "ERROR"
            elif "success" in lower:
                status = "SUCCESS"
            else:
                status = "SUCCESS"  # par défaut, optimiste
        else:
            status = "ERROR"

        # 📌 3. Ajouter à la liste
        summary.append({
            "tool_name": tool,
            "enumerate_command": cmd_str,
            "status": status
        })

    return summary



def format_services(services: List[Dict]) -> str:
    lignes = []
    for s in services:
        if not isinstance(s, dict):
            continue
        port = s.get("port", "?")
        tech = s.get("technologie", "Inconnu")
        version = s.get("version", "—") or "—"
        cpe = s.get("cpe", "—") or "—"
        cve = s.get("cve", "—") or "—"
        lignes.append(f"- Port {port} : {tech} {version} | CPE: {cpe} | CVE: {cve}")
    return "\n".join(lignes)

def is_version_more_precise(v_new: str, v_old: str) -> bool:
    """Retourne True si v_new est plus détaillée que v_old."""
    if not v_old or v_old.lower() in {"", "n/a", "unknown", "—"}:
        return True
    if not v_new or v_new.lower() in {"", "n/a", "unknown", "—"}:
        return False
    return v_new.count(".") > v_old.count(".")

def merge_enriched_entry(results: list[dict], new_entry: dict) -> None:
    """Fusionne intelligemment un nouveau service enrichi dans la liste globale."""
    port = new_entry.get("port")
    tech = new_entry.get("technologie", "").lower()

    # Cherche un service existant avec même port + techno
    match = next(
        (e for e in results if e.get("port") == port and e.get("technologie", "").lower() == tech),
        None
    )

    has_new_cpe = any(c.lower() not in {"", "n/a", "—"} for c in new_entry.get("cpes", []))
    has_new_cve = new_entry.get("cve", "") not in {"", "—", None}

    if not match:
        results.append(new_entry)
        print(f"[ADD] ➕ Nouveau service {tech}:{port} ajouté.")
        return

    old_cpes = match.get("cpes", [])
    old_cve = match.get("cve", "")
    new_version = new_entry.get("version", "")
    old_version = match.get("version", "")

    if has_new_cpe or has_new_cve:
        print(f"[REPLACE] ✅ Remplacement de {tech}:{port} (nouvelle CPE/CVE détectée).")
        results.remove(match)
        results.append(new_entry)
    elif is_version_more_precise(new_version, old_version):
        print(f"[REPLACE] ✨ Remplacement de {tech}:{port} (version plus précise).")
        results.remove(match)
        results.append(new_entry)
    else:
        print(f"[SKIP] ❌ Aucun gain utile pour {tech}:{port}, ligne ignorée.")

def format_commandes(commandes_executées: List[Dict]) -> str:
    lignes = []
    for cmd in commandes_executées:
        # Parser YAML si c’est une chaîne
        if isinstance(cmd, str):
            try:
                cmd = yaml.safe_load(cmd)
            except Exception:
                continue

        if not isinstance(cmd, dict):
            continue  # ignorer les entrées inutilisables

        outil = cmd.get("tool_name", "Inconnu")
        commande = cmd.get("enumerate_command", "").strip()
        statut = cmd.get("status", "Inconnu")

        port_info = ""
        if "-p" in commande:
            try:
                index = commande.index("-p")
                ports = commande[index:].split()[1]
                port_info = f" (Ports: {ports})"
            except Exception:
                pass

        lignes.append(f"- {outil}{port_info} : {statut}\n  → {commande}")

    return "\n".join(lignes) if lignes else "Aucune commande exécutée."

def get_constraints_for_tech(tech: str) -> Tuple[str, str]:
    """
    Retourne les blocs 'Outils Recommandés' et 'Interdits' pour une technologie donnée.
    """
    tool_map = {
        "ftp": {
            "ok": [
                "nmap --script ftp-anon",
                "nmap --script ftp-bounce",
                "nmap --script ftp-syst",
                "echo | nc {target} 21"
            ],
            "ban": ["enum4linux", "smbclient", "rpcclient", "http", "ssh", "telnet"]
        },
        "http": {
            "ok": [
                "whatweb {target}",
                "curl -I http://{target}",
                "nmap --script http-title -p 80 {target}"
            ],
            "ban": ["ftp", "ssh", "enum4linux", "telnet", "smtp"]
        },
        "https": {
            "ok": [
                "curl -Ik https://{target}",
                "nmap --script ssl-cert -p 443 {target}",
                "nmap --script ssl-enum-ciphers -p 443 {target}"
            ],
            "ban": ["ftp", "rpcclient", "smbclient", "telnet"]
        },
        "smtp": {
            "ok": [
                "openssl s_client -connect {target}:25 -starttls smtp",
                "nmap --script smtp-commands -p 25 {target}"
            ],
            "ban": ["ftp", "telnet", "http", "rpcclient"]
        },
        "smb": {
            "ok": [
                "enum4linux -a {target}",
                "smbclient -L {target} -N",
                "rpcclient -U '' {target} -c 'enumdomusers'"
            ],
            "ban": ["ftp", "http", "curl", "ssh", "snmp"]
        },
        "snmp": {
            "ok": [
                "snmpwalk -v2c -c public {target}",
                "snmp-check {target}",
                "nmap --script snmp-info -p 161 {target}"
            ],
            "ban": ["ftp", "ssh", "http", "rpcclient"]
        },
        "ssh": {
            "ok": [
                "ssh -v {target}",
                "nmap --script ssh2-enum-algos -p 22 {target}",
                "nmap --script ssh-hostkey -p 22 {target}"
            ],
            "ban": ["ftp", "http", "rpcclient", "smbclient"]
        },
        "domain": {
            "ok": [
                "dig {target}",
                "nslookup {target}",
                "nmap --script dns-recursion {target}",
                "nmap --script dns-nsid {target}"
            ],
            "ban": ["ftp", "ssh", "http", "smbclient"]
        },
        "telnet": {
            "ok": [
                "echo | nc {target} 23",
                "nmap --script telnet-encryption -p 23 {target}"
            ],
            "ban": ["ftp", "ssh", "enum4linux", "http"]
        },
        "rpcbind": {
            "ok": [
                "rpcinfo -p {target}",
                "nmap --script rpcinfo -p 111 {target}"
            ],
            "ban": ["ftp", "ssh", "http", "enum4linux"]
        },
        "exec": {
            "ok": [
                "nmap --script rsh-rexec -p 512 {target}",
                "rusers {target}"
            ],
            "ban": ["ftp", "ssh", "smbclient", "http", "rpcclient"]
        },
        "login?": {
            "ok": [
                "nmap --script rusers -p 513 {target}",
                "finger {target}"
            ],
            "ban": ["ftp", "http", "rpcclient", "ssh"]
        }
    }


    tech = tech.lower()
    if tech in tool_map:
        ok_tools = tool_map[tech]["ok"]
        ban_tools = tool_map[tech]["ban"]
    else:
        ok_tools = ["nmap -sV -p", "lecture de bannière", "scripts NSE génériques"]
        ban_tools = ["enum4linux", "ftp", "ssh", "smbclient", "telnet"]

    ok_block ="\n".join(f"- {tool}" for tool in ok_tools)

    ban_block ="\n".join(f"- {tool}" for tool in ban_tools)

    return ok_block, ban_block

def phase2(target: str, results: List, history: List, log: List, max_iterations) -> Tuple[List, List, List]:
    iteration = 0
    

    while iteration < max_iterations:

        print("\n=== Phase 2 : Boucle dynamique d'exploration ===")

        print(f"\n[INFO] Début de l’itération {iteration + 1}/{max_iterations}")


        services_incomplets = extract_incomplete_services_structured(results,history)
        commandes_executées = extract_executed_commands_checked(history)

        #print("historyy :  ",history)
        
        
        if not services_incomplets:
            print("[INFO] Tous les services sont complets.")
            print("resultss : ", results)
            return results, history, log  
        
        else:
            print("les services incomplets sont :    ",services_incomplets)
            print("\n[INFO] Commandes déjà exécutées :")
            for cmd in commandes_executées:
                print(f"- Outil : {cmd['tool_name']} | Commande : {cmd['enumerate_command']} | Statut : {cmd['status']}")

            # Ciblage d’un seul service par itération
            service = services_incomplets[0]
            tech = service.get("technologie", "").lower()
            port = service.get("port", "??")
            version = service.get("version", "N/A")
            cpe = service.get("cpe", "—")
            cve = service.get("cve", "—")

            print(f"[DEBUG] ➤ Service ciblé : {tech}:{port} (version: {version})")

            # Contraintes dynamiques
            ok_block, ban_block = get_constraints_for_tech(tech)
            
            
            prompt_loop = f"""
            <s>[INST]
            Tu es un assistant pentester intelligent spécialisé dans la collecte de version de services.

            ### 🎯 CIBLE À ANALYSER :
            - Adresse cible : {target}
            - Port : {port}
            - Technologie : {tech}
            - Version actuelle : {version}
            - CPE : {cpe}
            - CVE : {cve}

            

            ### ✅ OUTILS STRICTEMENT AUTORISÉS POUR {tech}
            Tu dois obligatoirement choisir l’un **et un seul** des outils suivants :

            {ok_block}

            ⛔ Tu n’as le droit d’utiliser **aucun autre outil ou script**, même s’il semble pertinent.  
            ⛔ N’invente jamais un script Nmap ou une option qui n’existe pas dans `/usr/share/nmap/scripts/`.
            ❌ Toute commande non listée ci-dessus sera automatiquement rejetée.

            

            ⚠️ Tu ne peux **PAS proposer de script qui n’existe pas dans `/usr/share/nmap/scripts/`**.
            Tu dois choisir **littéralement** un des outils listés ci-dessous.

            
            ###❌ OUTILS STRICTEMENT INTERDITS POUR {tech}
            {ban_block}


            ### 📜 COMMANDES DÉJÀ TESTÉES :
            {format_commandes(commandes_executées)}

            ---

            ### 🛠️ OBJECTIF CLAIR :
            Tu dois générer **une seule commande** qui vise à obtenir une **version plus précise** du service `{tech}` sur le port `{port}`.

            Cette commande servira à deviner un CPE plus précis et détecter des vulnérabilités (CVE) associées.

            ---

            ### 📦 FORMAT YAML STRICT ATTENDU :
            ```yaml
            tool_name: <nom précis de l’outil utilisé>
            enumerate_command: <commande complète utilisable immédiatement avec {target}>
            install_command: <commande apt-get ou pip install pour installer cet outil>
           ```

            ### ⚠️ CONTRAINTES CRITIQUES À RESPECTER ABSOLUMENT :

            - ✅ UNE SEULE commande dans `enumerate_command` (pas de `&&`, `;`, `|`)
            - ✅ UNE SEULE commande d'installation propre dans `install_command` (pas de `&&`, `;`, `apt update &&`, etc.)
            - ❌ Ne pas mélanger commande d'installation et d'énumération dans une même ligne
            - ❌ AUCUN placeholder : pas de `<ip>`, `<host>`, `<target>`, `<port>` → tu dois utiliser la **vraie cible** `{target}` et le **vrai port** `{port}`
            - ❌ AUCUNE redirection de sortie : pas de `>`, `>>`, `tee`, `--output`, etc.
            - ❌ Ne pas proposer une commande ou un outil déjà utilisé dans les commandes précédentes
            - ❌ Ne pas utiliser d'options comme `--interactive`, `-i`, `-A`, `-oN`, `-oG`
            - ❌ Ne pas proposer d'outil nécessitant une interaction manuelle ou un shell
            - ❌ Ne pas utiliser d’outil d’exploitation, de fuzzing ou de bruteforce
            - ❌ **NE JAMAIS proposer un outil en dehors de la liste AUTORISÉE** pour cette technologie
            - ✅ Tu dois choisir **UN SEUL outil** dans la liste autorisée, et ne proposer **AUCUN AUTRE**
            - ✅ La commande doit être compatible Kali Linux, exécutable directement sans interaction
            - ✅ Tout doit s'exécuter en moins de 2 minutes et produire une sortie exploitable dans le terminal

            [/INST]</s>
            """
            print("les outils autorisés :",{ok_block})
            response = query_llm(prompt_loop)    
            if not response:
                print("Impossible de communiquer avec llm ou réponse invalide.")
                iteration += 1
                print(f"[INFO] Nombre d'itérations effectuées : {iteration}/{max_iterations}")
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
                - JAMAIS d'outil déjà utilisé
                - PRIVILÉGIEZ l'identification des CVE et scoring CVSS
                - NE JAMAIS utiliser de placeholder comme <ip>, <port> : toujours une valeur réelle
                - La clé install_command DOIT contenir une commande d'installation complète comme `sudo apt-get install nmap`
                - COMMANDES INTERDITES = ['--interactive', '-i', '--verbose', '-A', 'telnet', 'ftp', 'msfconsole', 'hydra -V', 'burp-suite']
                
                [/INST]</s>
                """
                
                response = query_llm(fix_prompt)
                if not is_valid_tool_yaml(response):
                    print("[ERREUR] Impossible de générer un YAML valide. Passons à l'étape suivante.")
                    iteration += 1
                    print(f"[INFO] Nombre d'itérations effectuées : {iteration}/{max_iterations}")
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
                
                Répondez UNIQUEMENT avec le format YAML suivant, sans aucun texte supplémentaire :
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
                    iteration += 1
                    print(f"[INFO] Nombre d'itérations effectuées : {iteration}/{max_iterations}")
                    continue
            
                
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
                        # 🚫 Sécurité anti-hallucination : suppression forcée du CPE s'il vient du LLM
                        if isinstance(result_yaml, dict):
                            if "cpe" in result_yaml:
                                print(f"[WARN] CPE halluciné détecté → supprimé : {result_yaml['cpe']}")
                                result_yaml["cpe"] = "—"
                            if "cpes" in result_yaml:
                                print(f"[WARN] Liste CPE halluciné → supprimée : {result_yaml['cpes']}")
                                result_yaml["cpes"] = []
                        elif isinstance(result_yaml, list):
                            for entry in result_yaml:
                                if "cpe" in entry:
                                    print(f"[WARN] CPE halluciné détecté → supprimé : {entry['cpe']}")
                                    entry["cpe"] = "—"
                                if "cpes" in entry:
                                    print(f"[WARN] Liste CPE halluciné → supprimée : {entry['cpes']}")
                                    entry["cpes"] = []
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
                                if isinstance(result_yaml, dict):
                                    new_entries = [result_yaml]
                                elif isinstance(result_yaml, list):
                                    new_entries = result_yaml
                                else:
                                    new_entries = []

                                # 🔍 Enrichissement CVE uniquement sur les nouveaux résultats
                                try:
                                    enriched_new_entries = enrich_report_with_cve([new_entries])[0]
                                except Exception as e:
                                    print(f"[WARNING] Échec de l'enrichissement CVE pour cette commande : {e}")
                                    enriched_new_entries = new_entries

                                for new_entry in enriched_new_entries:
                                    merge_enriched_entry(results, new_entry)

                                print("[INFO] Résultats enrichis avec les CVE (nouveaux services) :", enriched_new_entries)
                                    
                        history.append({"command": response, "result": analyzed_result})
                                #print("[INFO] Résultats enrichis avec les CVE.", results)
                                #iteration += 1
                                #print(f"[INFO] Nombre d'itérations effectuées : {iteration}/{max_iterations}")

                    except Exception as e:
                        print(f"[DEBUG] Erreur lors de la vérification du statut d'analyse: {e}")
                    
                        history.append({"command": response, "result": analyzed_result})
                else:
                    print("[INFO] Analyse impossible. Ajout du résultat brut à l'historique.")
                    history.append({"command": response, "result": result})
            else:
                print("La commande d'énumération a échoué. Vérifiez la cible ou les permissions.")
            
                history.append({"command": response, "result": "[ERREUR] La commande a échoué."})

            iteration += 1
            print(f"[INFO] Nombre d'itérations effectuées : {iteration}/{max_iterations}")

    print("results:",results)
    return results, log, history

def generate_final_report(target: str, results: List, history: List) -> None:
    from datetime import datetime
    from jinja2 import Environment, FileSystemLoader
    import pdfkit

    # Filtrage initial
    flat_results = [entry for entry in results if isinstance(entry, dict)]
    results_filtered = remove_duplicates_keep_best(flat_results)

    # Construction du bloc CVE
    cve_items = []
    for entry in results_filtered:
        if entry.get("vulnerable") and entry.get("cve") and entry["cve"] != "—":
            for cve in [c.strip() for c in entry["cve"].split(",") if c.strip()]:
                cve_items.append({
                    "cve": cve,
                    "tech": entry.get("technologie", "Service inconnu"),
                    "port": entry.get("port", "N/A")
                })

    cve_recos = []

    if cve_items:
        prompt_cve_block = "\n".join(
            f"- CVE : {item['cve']} | Service : {item['tech']} | Port : {item['port']}"
            for item in cve_items
        )

        cve_prompt = f"""
        <s>[INST]
        Tu es un expert en sécurité offensive.
        Voici une liste de vulnérabilités :
        {prompt_cve_block}

        Fournis pour chaque CVE :
        - Une ligne de description
        - Une ligne de recommandation
        Format :
        CVE-XXXX-YYYY :
        - Description : ...
        - Recommandation : ...
        CONTRAINTES :
        - Une section par CVE
        - Pas d’intro ni de conclusion
        - Pas de HTML ou Markdown
        [/INST]</s>
        """

        cve_response = query_llm(cve_prompt, max_tokens_override=800)
        if cve_response:
            current = []
            for line in cve_response.strip().splitlines():
                if not line.strip() and current:
                    cve_recos.append("\n".join(current))
                    current = []
                else:
                    current.append(line.strip())
            if current:
                cve_recos.append("\n".join(current))

    elif results_filtered:
        # Pas de CVE mais services présents
        services_detectes = "\n".join(
            f"- Port {entry.get('port', '??')} : {entry.get('technologie', '??')} {entry.get('version', '')}"
            for entry in results_filtered
        )

        fallback_prompt = f"""
        <s>[INST]
        Voici les services détectés :
        {services_detectes}

        ###FORMAT DE SORTIE STRICT ET OBLIGATOIRE :
        1 - Risques potentiels :
        - ...
        2 - Mesures de sécurité préventives :
        - ...
        
        ###CONTRAINTES :
        - Une seule ligne par élément
        - Pas d’intro ni de conclusion
        - Ne pas mentionner de CVE
        - Respectes le format de sortie
        [/INST]</s>
        """
        fallback_response = query_llm(fallback_prompt, max_tokens_override=400)
        if fallback_response:
            cve_recos = [fallback_response.strip()]

    path_to_wkhtmltopdf = "/root/Pentral/wkhtmltopdf/bin/wkhtmltopdf.exe"
    # config = pdfkit.configuration(wkhtmltopdf=path_to_wkhtmltopdf)
    config = pdfkit.configuration(wkhtmltopdf='/usr/local/bin/wkhtmltopdf')
    env = Environment(loader=FileSystemLoader('/root/Pentral/rapportpfe'))
    template = env.get_template('rapport_template.html')

    html_content = template.render(
        project_title="Rapport d'énumération automatisée",
        project_name="usthb",
        scan_id="001",
        target_ip=target,
        date=datetime.now().strftime("%d/%m/%Y"),
        results=results_filtered,
        remarks=None,
        cve_recommendations=cve_recos
    )

    output_pdf = "/root/Pentral/rapportpfe/rapport_final.pdf"
    options = {
        'enable-local-file-access': None,
        'footer-right': '[page]/[topage]',
        'footer-font-size': '8',
        'footer-spacing': '5',
    }

    # pdfkit.from_string(html_content, output_pdf, configuration=config, options=options)
    # print("\n✅ Rapport PDF généré avec succès : rapport_final.pdf")
# Créer le chemin pour sauvegarder le PDF
    reports_dir = os.path.abspath('/root/Pentral/backend/app/static/reports')
    os.makedirs(reports_dir, exist_ok=True)

    filename = f"test_normal.pdf"
    file_path = os.path.join(reports_dir, filename)

    # URL relative pour stocker dans la DB
    relative_url = f"/static/reports/{filename}"
    output_path = os.path.join(reports_dir, filename)
    
    try:
        process = subprocess.run(
            [
                "xvfb-run", "--auto-servernum", "--server-args=-screen 0 1024x768x24",
                "/usr/local/bin/wkhtmltopdf", "-", output_path
            ],
            input=html_content.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )
        print("\n✅ Rapport PDF généré avec succès :", output_path)
    except subprocess.CalledProcessError as e:
        print("[❌ ERREUR] wkhtmltopdf a échoué :")
        print(e.stderr.decode())
            
    # Sauvegarde de l’historique
    command_history = load_command_history()
    for entry in history:
        cmd = entry.get("command")
        if isinstance(cmd, str):
            try:
                yaml_data = yaml.safe_load(cmd)
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
    print("\n[INFO] Historique des commandes sauvegardé.")


def is_valid_ip(ip: str) -> bool:
    try:
        socket.inet_aton(ip)
        return True
    except socket.error:
        return False

def is_valid_domain(domain: str) -> bool:
    """
    Vérifie si une chaîne est un nom de domaine valide (RFC 1035 + support IDN partiel).
    """
    if len(domain) > 253:
        return False
    if domain.startswith("http"):
        domain = extract_domain(domain)
    # Accepte les IDN (xn--), nouveaux TLDs, etc.
    domain_regex = r"^(?=.{1,253}$)(?!\-)(?:[a-zA-Z0-9\-]{1,63}\.)+[a-zA-Z]{2,}$"
    if not re.match(domain_regex, domain):
        return False

    # Vérifie qu'il n'y a pas de double point
    if ".." in domain:
        return False

    return True
from urllib.parse import urlparse

def extract_domain(url: str) -> str:
    parsed = urlparse(url if "://" in url else "http://" + url)
    return parsed.hostname or ""

import socket
from typing import List

import ipaddress
import subprocess
from typing import List

def resolve_domain(domain: str) -> List[str]:
    """
    Résout récursivement les IPs d’un domaine (même via CNAME) en utilisant `dnsx`.
    Fonctionne dans le conteneur Docker. Retourne une liste d'IPv4 valides.
    """
    try:
        cmd = f"echo {domain} | dnsx -a -resp -silent -t 3"
        output = execute_command_docker(cmd)

        if not output or output.strip() == "":
            print(f"[ERREUR] Résolution échouée avec dnsx pour le domaine {domain}")
            return []

        ips = []
        for line in output.strip().splitlines():
            parts = line.strip().split()
            if len(parts) != 2:
                continue
            ip_raw = parts[1].strip().strip("[]")
            try:
                ip = str(ipaddress.IPv4Address(ip_raw))
                ips.append(ip)
            except ValueError:
                continue  # Ignore les CNAMEs ou les IPv6 si tu veux rester en IPv4

        if not ips:
            print(f"[INFO] Aucun A record trouvé, mais le domaine {domain} existe peut-être via CNAME.")

        return ips

    except Exception as e:
        print(f"[ERREUR] Exception pendant la résolution via dnsx : {e}")
        return []


def get_whois_info(domain: str) -> dict:
    """
    Exécute WHOIS dans le conteneur Docker et parse les champs utiles.
    Gère les erreurs réseau (connexion refusée, absence de données...).
    """
    command = f"whois {domain}"
    install_cmd = "apt-get install -y whois"
    output = execute_command_docker(command)

    # 📦 Installation si WHOIS non présent
    if "not found" in output.lower():
        print("[INFO] WHOIS introuvable. Tentative d'installation...")
        install_result = execute_install_docker(install_cmd)
        if not install_result:
            return {"Domaine": domain, "Erreur": "Échec d’installation de WHOIS"}
        output = execute_command_docker(command)

    # ❌ Cas d'erreurs réseau fréquentes
    connection_errors = [
        "connect: connection refused",
        "connection timed out",
        "network is unreachable",
        "temporary failure",
        "nameserver not found",
        "no match for",
        "error",
    ]
    if "NAMESERVER NOT FOUND" in output:
        return {
            "Domaine": domain,
            "Registrar": None,
            "Date de création": None,
            "Date d’expiration": None,
            "Date de mise à jour": None,
            "Serveurs DNS": [],
            "Statut": "WHOIS limité ou protégé par le registrar",
            "Email(s)": [],
            "Erreur": "WHOIS limité ou protégé"
        }

    if not output or any(err in output.lower() for err in connection_errors):
        return {"Domaine": domain, "Erreur": "WHOIS inaccessible ou vide"}

    lignes = output.splitlines()
    rapport = {
        "Domaine": domain,
        "Registrar": None,
        "Date de création": None,
        "Date d’expiration": None,
        "Date de mise à jour": None,
        "Serveurs DNS": [],
        "Statut": None,
        "Email(s)": []
    }

    for ligne in lignes:
        if ":" not in ligne:
            continue
        key, val = ligne.split(":", 1)
        val = val.strip()
        key_lower = key.lower()

        if "registrar" in key_lower:
            rapport["Registrar"] = val
        elif any(k in key_lower for k in ["creation", "created", "registration"]):
            rapport["Date de création"] = val
        elif any(k in key_lower for k in ["expiry", "expiration"]):
            rapport["Date d’expiration"] = val
        elif any(k in key_lower for k in ["updated", "last update"]):
            rapport["Date de mise à jour"] = val
        elif "name server" in key_lower:
            rapport["Serveurs DNS"].append(val)
        elif "status" in key_lower and "registrar" not in key_lower:
            rapport["Statut"] = val
        elif "email" in key_lower:
            rapport["Email(s)"].append(val)

    return rapport

    
import ipaddress

import tempfile
import os
import ipaddress

def is_tool_missing(output: str) -> bool:
    """
    Détermine si un outil est absent à partir d'un message d'erreur.
    """
    if not isinstance(output, str):
        return False
    return any(err in output.lower() for err in [
        "command not found", "not found", "no such file", "executable not found"
    ])

def enumerate_subdomains(domain: str) -> dict:
    """
    Découvre les sous-domaines avec subfinder, les valide avec dnsx,
    via un fichier temporaire copié dans Docker. Gère proprement les erreurs.
    """
    install_subfinder = "apt-get install -y subfinder"
    install_dnsx = "apt-get install -y dnsx"
    container_name = "kali-pentest"

    result = {
        "resolved": [],
        "ipv4_map": {},
        "ipv6_map": {},
        "errors": [],
        "success": True
    }

    # 1. Découverte des sous-domaines avec subfinder
    subfinder_cmd = f"subfinder -d {domain} -silent -all"
    print("[INFO] Découverte des sous-domaines avec subfinder...")
    output = execute_command_docker(subfinder_cmd)

    if not output or output.strip() == "":
        if is_tool_missing(output):
            print("[INFO] subfinder non trouvé. Tentative d'installation...")
            execute_install_docker(install_subfinder)
            output = execute_command_docker(subfinder_cmd)
            if not output or output.strip() == "":
                result["errors"].append("Échec subfinder même après installation.")
                result["success"] = False
                return result
        else:
            result["errors"].append("subfinder a échoué (outil présent mais erreur d'exécution).")
            result["success"] = False
            return result

    subdomains = list({line.strip() for line in output.splitlines() if line.strip()})
    print(f"[INFO] {len(subdomains)} sous-domaines découverts.")

    if not subdomains:
        print("[INFO] Aucun sous-domaine trouvé par subfinder.")
        return result  # success reste True, mais rien à valider

    # 2. Écriture dans un fichier temporaire local
    with tempfile.NamedTemporaryFile(mode="w+", delete=False) as f:
        for sub in subdomains:
            f.write(sub + "\n")
        temp_file_path = f.name

    # 3. Copie dans le conteneur Docker
    container_file_path = "/tmp/subs.txt"
    os.system(f"cp {temp_file_path} {container_file_path}")
    os.remove(temp_file_path)

    # 4. Validation DNS avec dnsx
    dnsx_cmd = f"dnsx -a -resp -silent -t 3 -l {container_file_path}"
    print("[INFO] Validation des sous-domaines avec dnsx...")
    dnsx_output = execute_command_docker(dnsx_cmd)
    print(f"[DEBUG] dnsx_output brut : {dnsx_output!r}", flush=True)


    if not dnsx_output or dnsx_output.strip() == "" or "[VIDE]" in dnsx_output:
        if is_tool_missing(dnsx_output):
            print("[INFO] dnsx non trouvé. Tentative d'installation...")
            execute_install_docker(install_dnsx)
            dnsx_output = execute_command_docker(dnsx_cmd)
            if not dnsx_output or dnsx_output.strip() == "" or "[VIDE]" in dnsx_output:
                result["errors"].append("Échec dnsx même après installation.")
                result["success"] = False
                return result
        elif "[ERREUR]" in dnsx_output or "[EXCEPTION]" in dnsx_output:
            print("[ERREUR] dnsx a échoué lors de l’exécution.")
            result["errors"].append("dnsx a échoué (outil présent mais erreur d'exécution).")
            result["success"] = False
            return result
        else:
            print("[INFO] Aucun sous-domaine valide détecté par dnsx.")
            result["resolved"] = []
            result["success"] = True
            return result
    pattern = r"^\s*([^\s]+)\s+\[([^\]]+)\]\s*$"

    # 5. Analyse des IPs retournées par dnsx
    for line in dnsx_output.splitlines():
        match = re.match(pattern, line.strip())
        if match:
            subdomain = match.group(1)
            ip = match.group(2)
        else:
            print(f"[DEBUG] Ligne ignorée (non matchée) : {line!r}")

        try:
            ip_obj = ipaddress.ip_address(ip)
            if isinstance(ip_obj, ipaddress.IPv4Address):
                result["ipv4_map"].setdefault(ip, []).append(subdomain)
            elif isinstance(ip_obj, ipaddress.IPv6Address):
                result["ipv6_map"].setdefault(ip, []).append(subdomain)

            if subdomain not in result["resolved"]:
                result["resolved"].append(subdomain)

        except ValueError:
            continue

    
    print(f"[INFO] Sous-domaines validés : {len(result['resolved'])}")
    # 🔎 Identifier les sous-domaines non résolus
    resolved_set = set(result["resolved"])
    non_resolved = list(set(subdomains) - resolved_set)
    result["non_resolved"] = non_resolved
    print(f"[INFO] Sous-domaines non résolus : {len(non_resolved)}")

    return result

def get_dns_records(domain: str) -> dict:
    """
    Exécute `dig` pour différents types d’enregistrements DNS.
    Si l’outil n’est pas installé, tente une installation automatique.
    Retourne un dictionnaire avec les résultats ou les erreurs rencontrées.
    """
    record_types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"]
    records = {"_errors": [], "_success": True}

    install_cmd = ["apt", "update", "&&", "apt", "install", "-y", "dnsutils"]

    for rtype in record_types:
        command = f"dig +short {rtype} {domain}"
        try:
            output = execute_command_docker(command)

            # Si l'outil n’est pas trouvé, tentative d’installation
            if "not found" in output.lower():
                print("[INFO] `dig` introuvable. Installation de dnsutils...")
                execute_install_docker(install_cmd)
                output = execute_command_docker(command)

            # Vérification des erreurs DNS classiques
            if not output or any(err in output.lower() for err in ["timed out", "servfail", "refused"]):
                records[rtype] = []
                records["_errors"].append(f"{rtype}: échec ou réponse invalide.")
                records["_success"] = False
            else:
                # Nettoyage des lignes vides
                records[rtype] = [line.strip() for line in output.splitlines() if line.strip()]

        except Exception as e:
            records[rtype] = []
            records["_errors"].append(f"{rtype}: {str(e)}")
            records["_success"] = False

    return records




def generate_domain_report(domain_name: str,
                           whois_data: dict,
                           dns_data: dict,
                           subdomains: list,
                           ip_results: list,
                           ipv6_map: dict,
                           remarks: str,
                           output_path: str = "/root/Pentral/rapportpfe/rapport_final.pdf") -> str:
    """
    Génère un rapport PDF d'énumération pour une cible de type domaine.
    Affiche les informations WHOIS, DNS, les sous-domaines (avec IP v4/v6), et les résultats d’analyse par IP.
    """
    try:
        # Défense contre les valeurs manquantes
        whois = {
            "registrar": whois_data.get("Registrar", "Non renseigné") if isinstance(whois_data, dict) else "Non renseigné",
            "creation_date": whois_data.get("Date de création", "Non renseignée") if isinstance(whois_data, dict) else "Non renseignée",
            "expiry_date": whois_data.get("Date d’expiration", "Non renseignée") if isinstance(whois_data, dict) else "Non renseignée",
            "dns_servers": whois_data.get("Serveurs DNS", []) if isinstance(whois_data, dict) else [],
            "status": whois_data.get("Statut", "Inconnu") if isinstance(whois_data, dict) else "Inconnu",
            "emails": whois_data.get("Email(s)", []) if isinstance(whois_data, dict) else []
        }

        # DNS Records filtrés
        filtered_dns = {k: v for k, v in dns_data.items() if not k.startswith("_")} if isinstance(dns_data, dict) else {}

        subdomain_list = subdomains if isinstance(subdomains, list) else []
        valid_ip_results = ip_results if isinstance(ip_results, list) else []
        final_remarks = remarks.strip() if isinstance(remarks, str) and remarks.strip() else "Aucune remarque disponible."

        # Configuration PDF
        path_to_wkhtmltopdf = "/root/Pentral/wkhtmltopdf/bin/wkhtmltopdf.exe"
        # config = pdfkit.configuration(wkhtmltopdf=path_to_wkhtmltopdf)
        config = pdfkit.configuration(wkhtmltopdf='/usr/local/bin/wkhtmltopdf')
        env = Environment(loader=FileSystemLoader('/root/Pentral/rapportpfe'))
        template = env.get_template('domain.html')


        html_content = template.render(
            project_title="Rapport d'énumération automatisée",
            project_name="usthb",
            scan_id="002",
            domain_name=domain_name,
            date=datetime.now().strftime("%d/%m/%Y"),
            whois=whois,
            dns_records=filtered_dns,
            subdomains=subdomain_list,
            ip_results=valid_ip_results,
            ipv6_map=ipv6_map,
            remarks=final_remarks
        )

        options = {
            'enable-local-file-access': None,
            'footer-right': '[page]/[topage]',
            'footer-font-size': '8',
            'footer-spacing': '5',
        }

        # pdfkit.from_string(html_content, output_path, configuration=config, options=options)
        # print(f"\n✅ Rapport PDF généré avec succès : {output_path}")
        
        
        # Créer le chemin pour sauvegarder le PDF
        reports_dir = os.path.abspath('/root/Pentral/backend/app/static/reports')
        os.makedirs(reports_dir, exist_ok=True)

        filename = f"test.pdf"
        file_path = os.path.join(reports_dir, filename)

        # URL relative pour stocker dans la DB
        relative_url = f"/static/reports/{filename}"
        output_path = os.path.join(reports_dir, filename)
        
        try:
            process = subprocess.run(
                [
                    "xvfb-run", "--auto-servernum", "--server-args=-screen 0 1024x768x24",
                    "/usr/local/bin/wkhtmltopdf", "-", output_path
                ],
                input=html_content.encode("utf-8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True
            )
            print("\n✅ Rapport PDF généré avec succès :", output_path)
        except subprocess.CalledProcessError as e:
            print("[❌ ERREUR] wkhtmltopdf a échoué :")
            print(e.stderr.decode())
        return output_path

    except Exception as e:
        print(f"\n❌ Échec de la génération du rapport domaine : {e}")
        return ""


def main():
    print("=== Générateur de Commandes d'Énumération Amélioré ===")
    

    while True:
        cible = input("🔍 Entrez une cible (adresse IP ou nom de domaine) : ").strip()
        if is_valid_ip(cible):
            print(f"[INFO] IP valide détectée : {cible}")
            target = cible
            target_type = "ip"
            break
        elif is_valid_domain(cible) and resolve_domain(cible):
            print(f"[INFO] Domaine valide résolu avec succès : {cible}")
            target = cible
            target_type = "domain"
            break
        else:
            print("[ERREUR] Cible invalide. Veuillez réessayer.\n")

    history = []  # Liste pour stocker les commandes et leurs résultats
    results = []  # Liste pour stocker les résultats d'analyse
    log = []

    print(f"Cible: {target}")
    # traitement selon le type de cible
    if target_type == "ip":
        print(f" Traitement spécifique pour l’adresse IP : {target}")
        print(f"\n Cible analysée : {target}")
        print("=== Phase 1 : Scan initial -sS + -sV + enrichissement ===")

        # Phase 1 : Scan et enrichissement
        results, log, history = phase1_initiale(target)
        max_iterations=4
        phase2(target, results, history, log,max_iterations)
        generate_final_report(target, results, history)


    elif target_type == "domain":
        print(f" Traitement spécifique pour le domaine : {target}")

        # 1. Résolution du domaine principal
        ip_to_names = {}
        resolved_ips_raw = resolve_domain(target)
        resolved_ips = [ip for ip in resolved_ips_raw if is_valid_ip(ip)]

        ipv4_map = {}
        ipv6_map = {}
        if not resolved_ips:
            print("[ERREUR] Aucune IP valide résolue pour le domaine principal.")
        else:
            print(f"[INFO] IPs valides résolues pour le domaine principal : {', '.join(resolved_ips)}")
            for ip in resolved_ips:
                # Ajoute le domaine dans ip_to_names (mappage IP → noms)
                if ip in ip_to_names:
                    if target not in ip_to_names[ip]:
                        ip_to_names[ip].append(target)
                else:
                    ip_to_names[ip] = [target]

                # Ajoute le domaine dans ipv4_map (pour usage dans le rapport)
                if ip in ipv4_map:
                    if target not in ipv4_map[ip]:
                        ipv4_map[ip].append(target)
                else:
                    ipv4_map[ip] = [target]

        # 2. Recherche des sous-domaines avec filtrage IPv4/IPv6
        subs = enumerate_subdomains(target)
        if not subs["success"]:
            print("[ERREUR] Énumération échouée :", subs["errors"])
            ipv4_map = {}
            ipv6_map = {}
        else:
            print(f"[INFO] {len(subs['resolved'])} sous-domaines résolus activement.")
            print(f"[INFO] IPv4 uniques à scanner : {len(subs['ipv4_map'])}")
            print(f"[INFO] IPv6 uniquement détectées : {len(subs['ipv6_map'])}")

            ipv4_map = subs["ipv4_map"]
            ipv6_map = subs["ipv6_map"]

            # On ajoute aussi le domaine principal dans la map IPv4
            for ip in resolved_ips:
                if ip in ipv4_map:
                    if target not in ipv4_map[ip]:
                        ipv4_map[ip].append(target)
                else:
                    ipv4_map[ip] = [target]

        # 3. WHOIS 
        print(f"[INFO] Récupération des informations WHOIS pour {target}...")
        whois_data = get_whois_info(target)
        if "Erreur" in whois_data:
            print("[ERREUR WHOIS] " + whois_data["Erreur"])
        else:
            print("[INFO] Données WHOIS récupérées :")
            for key, value in whois_data.items():
                print(f"  {key}: {value}")

        # 4. Enregistrements DNS
        dns_data = get_dns_records(target)
        if not dns_data.get("_success"):
            print("[ERREUR] Échec partiel ou total dans la récupération des DNS.")
            print("Détails des erreurs :", dns_data["_errors"])
        else:
            print("[INFO] Enregistrements DNS récupérés avec succès.")

        for rtype in ["A", "AAAA", "MX", "NS", "TXT", "CNAME"]:
            print(f"{rtype}: {dns_data.get(rtype, [])}")

        # 5. Analyse des IP IPv4 (en mettant le domaine principal en premier)
        full_report = []
        # Construction ordonnée : domaine principal d'abord
        all_items = list(ipv4_map.items())

        # Trie : place les IP liées au domaine cible tout en haut
        ordered_items = sorted(all_items, key=lambda x: target not in x[1])
        full_report = []

        for ip, noms in ordered_items:
            print(f"\n Scan IP : {ip} - associés à : {', '.join(noms)}")
            results, log, history = phase1_initiale(ip)
            max_iterations = 0
            Results, log, history = phase2(ip, results, history, log, max_iterations)

            # Construction des CVE détectées
            cve_recos = []
            for entry in Results:
                if entry.get("vulnerable") and entry.get("cve") and entry["cve"] != "—":
                    for cve in [c.strip() for c in entry["cve"].split(",") if c.strip()]:
                        cve_recos.append({
                            "cve": cve,
                            "tech": entry.get("technologie", "Service inconnu"),
                            "port": entry.get("port", "N/A")
                        })

            cve_lines = []

            if cve_recos:
                #  Cas CVE → description + recommandation
                cve_prompt_block = "\n".join(
                    f"- CVE : {item['cve']} | Service : {item['tech']} | Port : {item['port']}"
                    for item in cve_recos
                )

                cve_prompt = f"""
                <s>[INST]
                Tu es un expert en sécurité offensive.

                Voici des vulnérabilités détectées :
                {cve_prompt_block}

                Pour chaque CVE, fournis une brève **description** et une **recommandation**.

                FORMAT STRICT :
                CVE-XXXX-YYYY :
                - Description : ...
                - Recommandation : ...

                CONTRAINTES :
                - Une section par CVE
                - Pas d’intro ni de conclusion
                - Pas de HTML ou Markdown
                [/INST]</s>
                """
                cve_response = query_llm(cve_prompt, max_tokens_override=800)
                current = []
                for line in cve_response.strip().splitlines():
                    if line.strip() == "":
                        if current:
                            cve_lines.append("\n".join(current).strip())
                            current = []
                    else:
                        current.append(line)
                if current:
                    cve_lines.append("\n".join(current).strip())

            else:
                # ✅ Cas sans CVE → fallback général uniquement si services détectés
                services_detectes = "\n".join(
                    f"- Port {entry.get('port', '??')} : {entry.get('technologie', '??')} {entry.get('version', '')}"
                    for entry in Results if isinstance(entry, dict)
                )

                if services_detectes.strip():
                    fallback_prompt = f"""
                    <s>[INST]
                    Tu es un expert en cybersécurité.

                    Voici les services détectés :
                    {services_detectes}

                    
                    ###FORMAT DE SORTIE STRICT ET OBLIGATOIRE :
                    1 - Risques potentiels :
                    - ...
                    2 - Mesures de sécurité préventives :
                    - ...

                    ###CONTRAINTES :
                    - Une seule ligne par élément
                    - Pas d’intro ni de conclusion
                    - Ne pas mentionner de CVE
                    - Respectes le format de sortie
                    [/INST]</s>
                    """
                    fallback_reco = query_llm(fallback_prompt, max_tokens_override=400)
                    print("résultat du llm : \n",fallback_reco)
                    if fallback_reco:
                        cve_lines = [fallback_reco.strip()]

            # Résultats aplatis
            results_flat = []
            for r in Results:
                if isinstance(r, dict):
                    results_flat.append(r)
                elif isinstance(r, list):
                    results_flat.extend(entry for entry in r if isinstance(entry, dict))

            # Ajout à full_report
            full_report.append({
                "ip": ip,
                "noms": noms,
                "results": results_flat,
                "cve_recommendations": cve_lines
            })


        print("\n🧾 Résumé des résultats par IP résolue :\n")
        for entry in full_report:
            ip = entry["ip"]
            noms = ", ".join(entry["noms"])
            print(f"🌐 IP : {ip}")
            print(f"🔗 Liée à : {noms}")
            if entry.get("cve_recommendations"):
                print(f"💬 Recommandations : {len(entry['cve_recommendations'])} ligne(s) générée(s)")
                for reco in entry["cve_recommendations"]:
                    print(reco)
            else:
                print(f"💬 Recommandation : Aucune\n")

        for ip_entry in full_report:
            print(f"📊 IP : {ip_entry['ip']} - {len(ip_entry['results'])} services trouvés")

        # 6. Rapport final
        reports_dir = os.path.abspath('/root/Pentral/backend/app/static/reports')
        os.makedirs(reports_dir, exist_ok=True)

        filename = f"test.pdf"
        file_path = os.path.join(reports_dir, filename)

        # URL relative pour stocker dans la DB
        relative_url = f"/static/reports/{filename}"
        output_path = os.path.join(reports_dir, filename)
        
        generate_domain_report(
            domain_name=target,
            whois_data=whois_data,
            dns_data=dns_data,
            subdomains=subs["resolved"],
            ip_results=full_report,
            ipv6_map=ipv6_map,
            remarks="",
            output_path=output_path
        )



if __name__ == "__main__":
    main()