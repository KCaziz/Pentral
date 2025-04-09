from threading import Lock
from . import ajout_yaml

script_status = {
    "status": "ready",
    "user_response": None,
    "command": [],
    "user_command": None,
    "llm_response": None
}
status_lock = Lock()

def pause_script(data):
    command = data['command']
    with status_lock:
        script_status["status"] = "waiting"
        script_status["user_response"] = None
        script_status["llm_response"] = None
        script_status["user_command"] = None
        script_status["command"].append(command)
    return {"message": "Le script est en pause, attente utilisateur."}

def get_status():
    with status_lock:
        return script_status

def respond(data):
    user_response = data.get("response")
    user_command = data.get("user_command")
    with status_lock:
        script_status["status"] = "ready"
        script_status["user_response"] = user_response
        if user_response == 'n':
            script_status["user_command"] = user_command
    return {"message": "Réponse enregistrée."}

def run_script(data):
    target = data.get("target", "")
    if target:
        script_status["command"].clear()
        output = ajout_yaml.main(target)
        return {"output": output}
    return {"error": "Commande invalide"}, 400

def validate_script(data):
    command = data['command']
    with status_lock:
        script_status["status"] = "waiting"
        script_status["llm_response"] = data['is_valid']
        script_status["user_command"] = command
    return {"message": "Validation de l'utilisateur en cours "}

def validation_response(data):
    user_response = data.get("response")
    user_command = data.get("user_command")
    with status_lock:
        script_status["status"] = "ready"
        script_status["user_response"] = user_response
        if user_response == 'o':
            script_status["user_command"] = user_command
            script_status["command"][-1] = user_command
        else:
            script_status["user_command"] = script_status["command"][-1]
    return {"message": "Réponse enregistrée."}
