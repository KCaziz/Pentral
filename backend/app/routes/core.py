from flask import Blueprint, jsonify, request, send_from_directory
from functools import wraps
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os
from threading import Lock
from app.services import pentral_rapide, pentral_no_user, pentral_user
import bcrypt
from datetime import datetime, timedelta, timezone 
import jwt
from flask import current_app
from flask_jwt_extended import get_jwt_identity, jwt_required
from bson import ObjectId
from app import socketio  # importe bien le socketio déjà instancié
from flask_socketio import emit
from jinja2 import Environment, FileSystemLoader
import pdfkit
import subprocess

SECRET_KEY = "secret_secret"
from db import get_db

db = get_db()
users_collection = db["users"]
scans_collection = db["scans"]
projects_collection = db["projects"]
companies_collection = db["company"]
teams_collection = db["team"]
stats_collection = db["stats"]
contexts_collection = db["context"]

def sanitize_mongo_document(doc):
    if isinstance(doc, dict):
        return {k: sanitize_mongo_document(v) for k, v in doc.items()}
    elif isinstance(doc, list):
        return [sanitize_mongo_document(v) for v in doc]
    elif isinstance(doc, ObjectId):
        return str(doc)
    elif isinstance(doc, datetime):
        return doc.isoformat()
    else:
        return doc

core_bp = Blueprint("core", __name__, static_folder="../../../frontend/", static_url_path="/")

script_status = {"status": "ready", "user_response": None, "command": [], "user_command": None, "llm_refuse_reason" : "" , "llm_response": None, "llm_reasoning": [], "llm_finished": False}
status_lock = Lock()

# Variable globale pour suivre les sessions socket actives
active_socket_sessions = {}

# Gestionnaires Socket.IO
@socketio.on('connect')
def handle_connect():
    print(f"[SOCKET] Client connecté: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"[SOCKET] Client déconnecté: {request.sid}")
    # Nettoyage des sessions
    if request.sid in active_socket_sessions:
        del active_socket_sessions[request.sid]
    # Réinitialiser le callback si c'était ce client
    if hasattr(pentral_rapide, 'streaming_callback'):
        pentral_rapide.streaming_callback = None
    if hasattr(pentral_user, 'streaming_callback'):
        pentral_user.streaming_callback = None
    if hasattr(pentral_no_user, 'streaming_callback'):
        pentral_no_user.streaming_callback = None
        
@socketio.on('start_llm_query')
def start_llm_query(data):
    session_id = request.sid
    target = data.get('target', '')
    print(f"[SOCKET] Streaming activé pour {session_id}, cible: {target}")

    def send_token(token):
        try:
            socketio.emit("llm_response", {"token": token}, room=session_id)
        except Exception as e:
            print(f"[ERREUR] Envoi WebSocket: {str(e)}")
            socketio.emit("llm_error", {"error": str(e)}, room=session_id)

    # Enregistre le callback global
    pentral_no_user.streaming_callback = send_token
    pentral_rapide.streaming_callback = send_token
    pentral_user.streaming_callback = send_token

    emit("streaming_ready", {"status": "ready"})


@core_bp.route("/api/run", methods=["POST"])
def run_command():
    data = request.json
    target = data.get("target", "")
    
    if not target:
        return jsonify({"error": "Commande invalide"}), 400
    
    try:
        print(f"[API] Exécution pour cible: {target}")
        
        # script_status["command"].clear() # Votre code existant
        
        # Exécution avec streaming si un socket est actif
        output = pentral_rapide.main(target)
        
        # Signal de fin optionnel (déjà envoyé dans la fonction patched_query_llm)
        session_id = request.sid if hasattr(request, 'sid') else None
        if session_id and session_id in active_socket_sessions:
            socketio.emit("llm_end", {"final_text": output}, room=session_id)
            
        return jsonify({"output": output})
    except Exception as e:
        print(f"[ERREUR] Exécution: {str(e)}")
        return jsonify({"error": f"Erreur: {str(e)}"}), 500
    
@core_bp.route('/pause', methods=['POST'])
def pause_script():
    """Marque le script comme en pause et en attente de l'utilisateur."""
    global script_status
    data = request.json
    command = data['command']
    with status_lock:
        script_status["status"] = "waiting"
        script_status["user_response"] = None
        script_status["llm_response"] = "llm"
        script_status["user_command"] = None
        script_status["command"].append(command)
    return jsonify({"message": "Le script est en pause, attente utilisateur."})

@core_bp.route('/get_response', methods=['GET'])
def get_response():
    """Retourne l'état actuel du script (attente ou réponse prête)."""
    with status_lock:
        return jsonify(script_status)

@core_bp.route('/respond', methods=['POST'])
def respond():
    """Réception de la réponse utilisateur."""
    global script_status
    user_response = request.json.get("response")
    user_command = request.json.get("user_command")
    with status_lock:
        script_status["status"] = "ready"
        script_status["user_response"] = user_response
        if user_response == 'n':
            script_status["user_command"] = user_command
            # script_status["command"][-1] = user_command 
        return jsonify({"message": "Réponse enregistrée."})




@core_bp.route('/validation', methods=["POST"])
def validation():
    """Endpoint pour valider le script."""
    global script_status
    data = request.json
    command = data['command']
    with status_lock:
        script_status["status"] = "waiting"
        script_status["llm_response"] = data['is_valid']
        script_status["user_command"] = command
        return jsonify({"message": "Validation de l'utilisateur en cours "})
    return jsonify({"error": "Erreur de validation"}), 400

@core_bp.route('/validation_response', methods=["POST"])
def validation_response():
    """Endpoint pour obtenir la réponse de validation."""
    global script_status
    user_response = request.json.get("response")
    user_command = request.json.get("user_command")
    with status_lock:
        script_status["status"] = "ready"
        script_status["user_response"] = user_response
        print(f"Réponse utilisateur serveur : {user_response}")
        if user_response == 'o':
            script_status["user_command"] = user_command
            script_status["command"][-1] = user_command 
        else:
            script_status["user_command"] = script_status["command"][-1]
        return jsonify({"message": "Réponse enregistrée."})

##########################    NO USER   #########################################
@core_bp.route("/api/run_no_user", methods=["POST"])
def run_command_no_user():
    data = request.json  # Vérifie que le frontend envoie bien du JSON
    target = data.get("target", "")
    if target:
        script_status["command"].clear()
        output = pentral_no_user.main(target)
        return jsonify({"output": output})
    return jsonify({"error": "Commande invalide"}), 400

@core_bp.route('/send_command', methods=['POST'])
def send_command():
    """Endpoint pour envoyer une commande au script."""
    data = request.json
    command = data['command']
    with status_lock:
        script_status["status"] = "waiting"
        script_status["user_response"] = None
        script_status["llm_response"] = None
        script_status["user_command"] = None
        script_status["command"].append(command)
    return jsonify({"message": "Commande envoyée, attente de la réponse."})

@core_bp.route('/template_updated', methods=['POST'])
def template_updated():
    """Endpoint pour envoyer une commande au script."""
    with status_lock:
        script_status["status"] = "ready"
    return jsonify({"message": "Template mis à jour."})

@core_bp.route('/unpause', methods=['GET'])
def get_unpause():
    """Retourne l'état actuel du script."""
    with status_lock:
        return jsonify(script_status)


#########################   USER MANAGEMENT   #########################################

@core_bp.route('/api/signup', methods=['GET', 'POST'])
def create_user():
    data = request.json
    # Hash du mot de passe
    hashed_pw = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt())

    # Création de l'utilisateur avec mot de passe haché
    user = {
        "username": data["username"],
        "email": data["email"],
        "password": hashed_pw,
        "created_at": datetime.now(timezone.utc),
        "is_admin": False,
        # "company": data["company"],
        # "teams": []
    }

    users_collection.insert_one(user)
    return jsonify({"message": "Utilisateur créé"}), 201


@core_bp.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 404

    if not bcrypt.checkpw(password.encode("utf-8"), user["password"]):
        return jsonify({"error": "Mot de passe incorrect"}), 401

    payload = {
        "user_id": str(user["_id"]),
        "exp": datetime.now(timezone.utc) + timedelta(days=1)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    return jsonify({"token": token, "user_id":str(user["_id"]), "is_admin": user["is_admin"]})

# recupere un user
@core_bp.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id):
    user = users_collection.find_one({"_id": ObjectId(user_id)})

    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 404

    # Nettoyage des types non JSON-compatibles
    user["_id"] = str(user["_id"])
    
    for key, value in user.items():
        if isinstance(value, bytes):
            user[key] = value.decode("utf-8")  # Convertit les `bytes` en `str`

    return jsonify(user)

# Mettre à jour un utilisateur
@core_bp.route("/api/users/<user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.json
    try:
        update_data = {}
        if "username" in data:
            update_data["username"] = data["username"]
        if "email" in data:
            update_data["email"] = data["email"]

        if not update_data:
            return jsonify({"error": "Aucune donnée à mettre à jour"}), 400

        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Utilisateur introuvable"}), 404

        return jsonify({"message": "Utilisateur mis à jour"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Mettre à jour le mot de passe d'un utilisateur
@core_bp.route("/api/users/<user_id>/password", methods=["PUT"])
def update_password(user_id):
    data = request.json
    try:
        old_password = data.get("old_password")
        new_password = data.get("new_password")

        if not old_password or not new_password:
            return jsonify({"error": "Champs requis manquants"}), 400

        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "Utilisateur non trouvé"}), 404

        if not bcrypt.checkpw(old_password.encode("utf-8"), user["password"]):
            return jsonify({"error": "Mot de passe incorrect"}), 401

        hashed_pw = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt())
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password": hashed_pw}}
        )

        return jsonify({"message": "Mot de passe mis à jour avec succès"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500



################## Project Management ######################

# ajouter un projet
@core_bp.route("/api/projects", methods=["POST"])
def create_project():
    data = request.json
    required_fields = ["name", "created_by", "company"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Champs manquants"}), 400

    project = {
        "name": data["name"],
        "created_by": ObjectId(data["created_by"]),
        # "team_id": ObjectId(data["team_id"]),
        "company": data["company"] if data["company"] != ""  else "personnel", 
        "scans": [],
        "shared_with": [],
        "created_at": datetime.utcnow()
    }
    result = projects_collection.insert_one(project)
    return jsonify({"message": "Projet créé", "project_id": str(result.inserted_id)}), 201

# recupere les projets d'un user
@core_bp.route("/api/projects/<user_id>", methods=["GET"])
def get_user_projects(user_id):
    try:
        projects = list(projects_collection.find(
                {"created_by": ObjectId(user_id)},
            
        )) or []  # Retourne un tableau vide si aucun résultat

        for project in projects:
            project["_id"] = str(project["_id"])
            project["created_by"] = str(project["created_by"])
            project["company"] = str(project["company"])
            project["scans"] = project.get("scans", [])
            project["shared_with"] = project.get("shared_with", [])
            project["scans"] = [str(scan_id) for scan_id in project.get("scans", [])] 

        return jsonify(projects)  # Retourne toujours un tableau
    except Exception as e:
        return jsonify([]), 501  # Retourne un tableau vide en cas d'erreur

# recup un projet a partir d'un scan
def get_project_from_scan(scan_id):
    """Retrouve le projet associé à un scan donné"""
    try:
        project = projects_collection.find_one({
            "scans": ObjectId(scan_id)
        })
        if not project:
            print(f"[INFO] Aucun projet ne contient le scan {scan_id}")
            return None, None

        return project.get("name"), project.get("company")
    except Exception as e:
        print(f"[ERREUR] get_project_from_scan : {str(e)}")
        return None, None

# recupere un projet
@core_bp.route("/api/get_project/<project_id>", methods=["GET"])
def get_project(project_id):
    try:
        project = projects_collection.find_one({"_id": ObjectId(project_id)})
        if not project:
            return jsonify({"error": "Projet non trouvé"}), 404

        project["_id"] = str(project["_id"])
        project["created_by"] = str(project["created_by"])
        project["company"] = str(project["company"])
        project["scans"] = project.get("scans", [])
        project["shared_with"] = project.get("shared_with", [])

        project["scans"] = [str(scan_id) for scan_id in project.get("scans", [])] # Convertit les ObjectId en str
        return jsonify(project)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Supprimer un projet
@core_bp.route("/api/projects/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    try:
        # Vérifier que l'utilisateur peut supprimer ce projet
        # current_user_id = get_jwt_identity()  # Si vous utilisez JWT
        project = projects_collection.find_one({
            "_id": ObjectId(project_id),
        })

        if not project:
            return jsonify({"error": "Non autorisé ou projet non trouvé"}), 404

        # Supprimer les scans associés
        scans_collection.delete_many({"project_id": ObjectId(project_id)})
        # Finalement supprimer le projet
        projects_collection.delete_one({"_id": ObjectId(project_id)})

        return jsonify({"message": "Projet et données associées supprimés"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@core_bp.route("/api/projects/<project_id>/share", methods=["POST"])
def share_project(project_id):
    data = request.json
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email requis"}), 400

    try:
        user = users_collection.find_one({"email": email})
        if not user:
            return jsonify({"error": "Utilisateur non trouvé"}), 404

        projects_collection.update_one(
            {"_id": ObjectId(project_id)},
            {"$addToSet": {"shared_with": email}}
        )

        return jsonify({"message": "Projet partagé avec " + email}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


############################## SCAN MANAGEMENT ##############################

# Récupérer les scans d'un projet en forme de tableau
@core_bp.route("/api/projects/<project_id>/scans", methods=["GET"])
def get_project_scans(project_id):
    try:
        project = projects_collection.find_one({"_id": ObjectId(project_id)})
        if not project:
            return jsonify({"error": "Projet non trouvé"}), 404

        scan_ids = [ObjectId(scan_id) for scan_id in project.get("scans", [])]
        scans = list(scans_collection.find({"_id": {"$in": scan_ids}}))
        
        return jsonify([sanitize_mongo_document(scan) for scan in scans])
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# Récupérer les scans d'un user en forme de tableau
@core_bp.route("/api/get_scans_user/<user_id>", methods=["GET"])
def get_scans_user(user_id):
    try:
        # On récupère tous les scans lancés par l'utilisateur
        scans_cursor = scans_collection.find({"launched_by": ObjectId(user_id)})

        scans = []
        for scan in scans_cursor:
            scan["_id"] = str(scan["_id"])  # Convertir l'ObjectId en string
            if "project_id" in scan:
                scan["project_id"] = str(scan["project_id"])
            if "launched_by" in scan:
                scan["launched_by"] = str(scan["launched_by"])
            if "created_at" in scan:
                scan["created_at"] = scan["created_at"].isoformat()
            if "finished_at" in scan and scan["finished_at"]:
                scan["finished_at"] = scan["finished_at"].isoformat()

            scans.append(scan)



        return jsonify(scans), 200

    except Exception as e:
        print("Erreur dans get_scans_user:", e)
        return jsonify({"error": "Erreur serveur"}), 500
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# Récupérer un scan spécifique
@core_bp.route("/api/get_scan/<scan_id>", methods=["GET"])
def get_scan(scan_id):
    try:
        scans = scans_collection.find_one({"_id": ObjectId(scan_id)})
        if not scans:
            return jsonify({"error": "Projet non trouvé"}), 404

        scans["_id"] = str(scans["_id"])
        scans["project_id"] = str(scans["project_id"])
        scans["launched_by"] = str(scans["launched_by"])
        
        return jsonify([sanitize_mongo_document(scans)])
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# Supprimer un scan
@core_bp.route("/api/scans/<scan_id>", methods=["DELETE"])
def delete_scan(scan_id):
    try:
        # Vérifier que le scan existe
        scan = scans_collection.find_one({"_id": ObjectId(scan_id)})
        if not scan:
            return jsonify({"error": "Scan non trouvé"}), 404

        # Retirer ce scan de tous les projets qui le référencent
        projects_collection.update_many(
            {"scans": ObjectId(scan_id)},
            {"$pull": {"scans": ObjectId(scan_id)}}
        )

        # Supprimer le scan lui-même
        scans_collection.delete_one({"_id": ObjectId(scan_id)})

        return jsonify({"message": "Scan supprimé et références nettoyées"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

########################### SCAN 1  Création   ############################
@core_bp.route("/api/scans", methods=["POST"])
def create_empty_scan():
    data = request.json
    required_fields = ["project_id", "launched_by", "name"]

    if not all(field in data for field in required_fields):
        return jsonify({"error": "Champs manquants"}), 400

    scan = {
        "project_id": ObjectId(data["project_id"]),
        "launched_by": ObjectId(data["launched_by"]),
        "name": data["name"],
        "status": "waiting",
        "commands_executed": [],
        "type" : data["type"],
        "created_at": datetime.utcnow()
    }

    result = scans_collection.insert_one(scan)
    
    projects_collection.update_one(
        {"_id": ObjectId(data["project_id"])},
        {"$push": {"scans": result.inserted_id}}
    )
    return jsonify({"message": "Scan préparé", "scan_id": str(result.inserted_id)}), 201

################# SCAN 2  Lancement et Suivi No User ######################
@core_bp.route("/api/scans/<scan_id>/start_no_user", methods=["POST"])
def start_scan(scan_id):
    data = request.json
    target = data.get("target")
    project_title, project_name = get_project_from_scan(scan_id)
    if not project_title:
        return jsonify({"error": "Projet introuvable pour ce scan"}), 404
    if not target:
        return jsonify({"error": "Target requise"}), 400

    try:
        scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "target": target,
                    "status": "running",
                    "started_at": datetime.utcnow()
                }
            }
        )

        # Lancer le script
        script_status["command"].clear()

        session_id = request.sid if hasattr(request, 'sid') else None
        
        output = pentral_no_user.main(target)
        
        if session_id and session_id in active_socket_sessions:
            socketio.emit("llm_end", {"final_text": str(output)}, room=session_id)


        if not output:
            return jsonify({"error": "Pas d'output fourni"}), 400
        
        path_to_wkhtmltopdf = "/root/Pentral/wkhtmltopdf/bin/wkhtmltopdf.exe"
        # config = pdfkit.configuration(wkhtmltopdf=path_to_wkhtmltopdf)
        config = pdfkit.configuration(wkhtmltopdf='/usr/local/bin/wkhtmltopdf')
        env = Environment(loader=FileSystemLoader('/root/Pentral/rapportpfe'))
        template = env.get_template('rapport_template.html')
        
        # Aplatir la liste si elle est imbriquée
        
        output["scan_id"] = scan_id
        output["project_title"] = project_title
        output["project_name"] = project_name

        html_content = template.render(**output)

        # Créer le chemin pour sauvegarder le PDF
        reports_dir = os.path.abspath('/root/Pentral/backend/app/static/reports')
        os.makedirs(reports_dir, exist_ok=True)

        filename = f"report_{scan_id}.pdf"
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
        
        # Update du scan
        scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "report_url": output_path,
                    "status": "completed",
                    "finished_at": datetime.utcnow()
                }
            }
        )

        return jsonify({"message": "Scan terminé", "output": output}), 200

    except Exception as e:
        scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "status": "error",
                    "finished_at": datetime.utcnow()
                }
            }
        )
        return jsonify({"error": str(e)}), 500

   
############################# SCAN 2  Lancement USER ######################
@core_bp.route("/api/scans/<scan_id>/start_user", methods=["POST"])
def start_scan_reason(scan_id):
    data = request.json
    target = data.get("target")

    project_title, project_name = get_project_from_scan(scan_id)
    if not project_title:
        return jsonify({"error": "Projet introuvable pour ce scan"}), 404
    if not target:
        return jsonify({"error": "Target requise"}), 400

    try:
        scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "target": target,
                    "status": "running",
                    "started_at": datetime.utcnow()
                }
            }
        )

        # Lancer le script
        script_status["command"].clear()
        script_status["llm_reasoning"].clear()
        script_status["llm_finished"] = False
        session_id = request.sid if hasattr(request, 'sid') else None

        output = pentral_user.main(target)
        
        if session_id and session_id in active_socket_sessions:
            socketio.emit("llm_end", {"final_text": str(output)}, room=session_id)


        if not output:
            return jsonify({"error": "Pas d'output fourni"}), 400
        
        path_to_wkhtmltopdf = "/root/Pentral/wkhtmltopdf/bin/wkhtmltopdf.exe"
        # config = pdfkit.configuration(wkhtmltopdf=path_to_wkhtmltopdf)
        config = pdfkit.configuration(wkhtmltopdf='/usr/local/bin/wkhtmltopdf')
        env = Environment(loader=FileSystemLoader('/root/Pentral/rapportpfe'))
        template = env.get_template('rapport_template.html')
        
        output["scan_id"] = scan_id
        output["project_title"] = project_title
        output["project_name"] = project_name

        html_content = template.render(**output)

        # Créer le chemin pour sauvegarder le PDF
        reports_dir = os.path.abspath('/root/Pentral/backend/app/static/reports')
        os.makedirs(reports_dir, exist_ok=True)

        filename = f"report_{scan_id}.pdf"
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
        
        # Update du scan
        scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "report_url": output_path,
                    "status": "completed",
                    "finished_at": datetime.utcnow()
                }
            }
        )
        return jsonify({"message": "Scan terminé", "output": output}), 200

    except Exception as e:
        scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$set": {
                    "status": "error",
                    "finished_at": datetime.utcnow()
                }
            }
        )
        return jsonify({"error": str(e)}), 500


############################# SCAN 3  Update No user ######################
@core_bp.route("/api/scans/<scan_id>/add_command", methods=["POST"])
def add_command_to_scan(scan_id):
    data = request.json
    command = data.get("command")

    if not command:
        return jsonify({"error": "Commande manquante"}), 400
    
    with status_lock:
        script_status["status"] = "ready"

    try:
        scans_collection.update_one(
            {"_id": ObjectId(scan_id)},
            {
                "$push": {"commands_executed": {"command": command}}
            }
        )
        return jsonify({"message": "Commande ajoutée"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
 
################## ADMIN MANAGEMENT ######################
def is_admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user or not user.get("is_admin", False):
            return jsonify({"error": "Accès non autorisé"}), 403
        return f(*args, **kwargs)
    return decorated

@core_bp.route("/api/admin/users/<user_id>", methods=["GET"])
def get_all_users(user_id):
    
    current_user = users_collection.find_one({"_id": ObjectId(user_id)})

    if not current_user or not current_user.get("is_admin", False):
        return jsonify({"error": "Accès non autorisé"}), 403

    users = list(users_collection.find({}, {"password": 0}))  # Ne retourne pas les mots de passe
    for u in users:
        u["_id"] = str(u["_id"])

    return jsonify(users), 200

@core_bp.route("/api/users/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "Utilisateur à supprimer introuvable"}), 404

        # Supprimer les scans lancés par l'utilisateur
        scans_collection.delete_many({"launched_by": ObjectId(user_id)})

        # Supprimer les projets créés par l'utilisateur
        projects_collection.delete_many({"created_by": ObjectId(user_id)})

        # Supprimer l'utilisateur
        users_collection.delete_one({"_id": ObjectId(user_id)})

        return jsonify({"message": "Utilisateur et ses données supprimés"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@core_bp.route("/api/admin/scans/<user_id>", methods=["GET"])
def get_all_scans_admin(user_id):
    current_user = users_collection.find_one({"_id": ObjectId(user_id)})

    if not current_user or not current_user.get("is_admin", False):
        return jsonify({"error": "Accès non autorisé"}), 403

    scans = list(scans_collection.find())
    for s in scans:
        s["_id"] = str(s["_id"])
        s["project_id"] = str(s["project_id"]) if "project_id" in s else None
        s["launched_by"] = str(s["launched_by"]) if "launched_by" in s else None
        s["team_id"] = str(s.get("team_id")) if "team_id" in s else None
        s["context_id"] = str(s.get("context_id")) if "context_id" in s else None

    return jsonify(scans), 200

@core_bp.route("/api/admin/projects/<user_id>", methods=["GET"])
def get_all_projects_admin(user_id):
    current_user = users_collection.find_one({"_id": ObjectId(user_id)})

    if not current_user or not current_user.get("is_admin", False):
        return jsonify({"error": "Accès non autorisé"}), 403

    projects = list(projects_collection.find())
    for p in projects:
        p["_id"] = str(p["_id"])
        p["created_by"] = str(p["created_by"]) if "created_by" in p else None
        p["company_id"] = str(p["company_id"]) if "company_id" in p else None
        p["shared_with"] = [str(uid) for uid in p.get("shared_with", [])]
        p["scans"] = [str(sid) for sid in p.get("scans", [])]

    return jsonify(projects), 200

@core_bp.route("/api/admin/stats/<user_id>", methods=["GET"])
def get_admin_stats(user_id):
    current_user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not current_user or not current_user.get("is_admin", False):
        return jsonify({"error": "Accès interdit"}), 403

    users = users_collection.count_documents({})
    projects = projects_collection.count_documents({})
    scans = list(scans_collection.find())
    scan_count = len(scans)
    completed = [s for s in scans if s.get("status") == "completed"]

    # Durée moyenne
    durations = []
    for s in completed:
        if s.get("started_at") and s.get("finished_at"):
            durations.append((s["finished_at"] - s["started_at"]).total_seconds())
    avg_duration = round(sum(durations) / len(durations) / 60, 2) if durations else None  # en minutes

    # Scans par jour
    from collections import Counter
    import datetime

    scan_dates = [s["created_at"].strftime("%Y-%m-%d") for s in scans if s.get("created_at")]
    count_by_day = Counter(scan_dates)
    scans_by_day = [{"date": d, "count": count_by_day[d]} for d in sorted(count_by_day)]

    return jsonify({
        "userCount": users,
        "projectCount": projects,
        "scanCount": scan_count,
        "completedScanCount": len(completed),
        "avgScanDuration": f"{avg_duration} min" if avg_duration else None,
        "TotalScansDuration": f"{round(sum(durations) / 60, 2)} min" if durations else None,
        "scansByDay": scans_by_day
    })


# Servir le frontend
@core_bp.route("/", defaults={"path": ""}, methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
@core_bp.route("/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
def serve_frontend(path):
    # Sinon, sert les fichiers statiques (JS, CSS, images, etc.)    
    full_path = os.path.join(core_bp.static_folder, path)
    if path != "" and os.path.exists(full_path):
        return send_from_directory(core_bp.static_folder, path)

    # Sinon, React gère la route
    return send_from_directory(core_bp.static_folder, "index.html")