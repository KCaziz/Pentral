# from flask import Flask, jsonify, request, send_from_directory
# from flask_cors import CORS
# import os
# import pentest_app.backend.app.services.ajout_yaml as ajout_yaml
# from threading import Lock
# from db import get_db

# db = get_db()
# users_collection = db["users"]
# scans_collection = db["scans"]
# projects_collection = db["projects"]



# app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")


# script_status = {"status": "ready", "user_response": None, "command": [], "user_command": None, "llm_response": None}
# status_lock = Lock()

# @app.route('/pause', methods=['POST'])
# def pause_script():
#     """Marque le script comme en pause et en attente de l'utilisateur."""
#     global script_status
#     data = request.json
#     command = data['command']
#     with status_lock:
#         script_status["status"] = "waiting"
#         script_status["user_response"] = None
#         script_status["llm_response"] = None
#         script_status["user_command"] = None
#         script_status["command"].append(command)
#     return jsonify({"message": "Le script est en pause, attente utilisateur."})

# @app.route('/get_response', methods=['GET'])
# def get_response():
#     """Retourne l'état actuel du script (attente ou réponse prête)."""
#     with status_lock:
#         return jsonify(script_status)

# @app.route('/respond', methods=['POST'])
# def respond():
#     """Réception de la réponse utilisateur."""
#     global script_status
#     user_response = request.json.get("response")
#     user_command = request.json.get("user_command")
#     with status_lock:
#         script_status["status"] = "ready"
#         script_status["user_response"] = user_response
#         if user_response == 'n':
#             script_status["user_command"] = user_command
#             # script_status["command"][-1] = user_command 
#         return jsonify({"message": "Réponse enregistrée."})


# @app.route("/api/run", methods=["POST"])
# def run_command():
#     data = request.json  # Vérifie que le frontend envoie bien du JSON
#     target = data.get("target", "")
#     if target:
#         script_status["command"].clear()
#         output = ajout_yaml.main(target)
#         return jsonify({"output": output})
#     return jsonify({"error": "Commande invalide"}), 400

# @app.route('/validation', methods=["POST"])
# def validation():
#     """Endpoint pour valider le script."""
#     global script_status
#     data = request.json
#     command = data['command']
#     with status_lock:
#         script_status["status"] = "waiting"
#         script_status["llm_response"] = data['is_valid']
#         script_status["user_command"] = command
#         return jsonify({"message": "Validation de l'utilisateur en cours "})
#     return jsonify({"error": "Erreur de validation"}), 400

# @app.route('/validation_response', methods=["POST"])
# def validation_response():
#     """Endpoint pour obtenir la réponse de validation."""
#     global script_status
#     user_response = request.json.get("response")
#     user_command = request.json.get("user_command")
#     with status_lock:
#         script_status["status"] = "ready"
#         script_status["user_response"] = user_response
#         print(f"Réponse utilisateur serveur : {user_response}")
#         if user_response == 'o':
#             script_status["user_command"] = user_command
#             script_status["command"][-1] = user_command 
#         else:
#             script_status["user_command"] = script_status["command"][-1]
#         return jsonify({"message": "Réponse enregistrée."})
    
# # creation d'un user
# @app.route('/api/signup', methods=['GET', 'POST'])
# def create_user():
#     print("Received request to /signup endpoint")
#     print("Request method:", request.method)
#     print("Request headers:", request.headers)
#     data = request.json
#     print("data : ",data)
#     users_collection.insert_one(data)
#     return jsonify({"message": "Utilisateur créé"}), 201


# # Servir le frontend
# @app.route("/", defaults={"path": ""}, methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
# @app.route("/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
# def serve_frontend(path):
#     # Empêche React de capturer des routes API invalides
#     if path.startswith("api/"):
#         return jsonify({"error": "Not found"}), 404

#     # Sinon, sert les fichiers statiques (JS, CSS, images, etc.)
#     full_path = os.path.join(app.static_folder, path)
#     if path != "" and os.path.exists(full_path):
#         return send_from_directory(app.static_folder, "index.html")

#     # Sinon, React gère la route
#     return send_from_directory(app.static_folder, "index.html")
