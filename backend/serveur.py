from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import pentest_app.backend.app.services.ajout_yaml as ajout_yaml
from threading import Lock

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")
CORS(app)

script_status = {"status": "ready", "user_response": None, "command": [], "user_command": None, "llm_response": None}
status_lock = Lock()

@app.route('/pause', methods=['POST'])
def pause_script():
    """Marque le script comme en pause et en attente de l'utilisateur."""
    global script_status
    data = request.json
    command = data['command']
    with status_lock:
        script_status["status"] = "waiting"
        script_status["user_response"] = None
        script_status["llm_response"] = None
        script_status["user_command"] = None
        script_status["command"].append(command)
    return jsonify({"message": "Le script est en pause, attente utilisateur."})

@app.route('/get_response', methods=['GET'])
def get_response():
    """Retourne l'état actuel du script (attente ou réponse prête)."""
    with status_lock:
        return jsonify(script_status)

@app.route('/respond', methods=['POST'])
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


@app.route("/api/run", methods=["POST"])
def run_command():
    data = request.json  # Vérifie que le frontend envoie bien du JSON
    target = data.get("target", "")
    if target:
        script_status["command"].clear()
        output = ajout_yaml.main(target)
        return jsonify({"output": output})
    return jsonify({"error": "Commande invalide"}), 400

@app.route('/validation', methods=["POST"])
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

@app.route('/validation_response', methods=["POST"])
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

# Servir le frontend
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and os.path.exists(f"../frontend/dist/{path}"):
        return send_from_directory("../frontend/dist", path)
    else:
        return send_from_directory("../frontend/dist", "index.html")

if __name__ == "__main__":
    app.run(debug=True, port=5000, host="0.0.0.0")  # Écoute sur toutes les interfaces réseau
