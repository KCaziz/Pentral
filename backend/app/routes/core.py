from flask import Blueprint, jsonify, request, send_from_directory
import os
from app.services import script_manager
from flask import current_app

core_bp = Blueprint("core", __name__)

@core_bp.route('/pause', methods=['POST'])
def pause_script():
    data = request.json
    return jsonify(script_manager.pause_script(data))

@core_bp.route('/get_response', methods=['GET'])
def get_response():
    return jsonify(script_manager.get_status())

@core_bp.route('/respond', methods=['POST'])
def respond():
    data = request.json
    return jsonify(script_manager.respond(data))

@core_bp.route('/api/run', methods=['POST'])
def run_command():
    data = request.json
    return jsonify(script_manager.run_script(data))

@core_bp.route('/validation', methods=['POST'])
def validation():
    data = request.json
    return jsonify(script_manager.validate_script(data))

@core_bp.route('/validation_response', methods=["POST"])
def validation_response():
    data = request.json
    return jsonify(script_manager.validation_response(data))

@core_bp.route('/', defaults={'path': ''})
@core_bp.route('/<path:path>')
def serve(path):
    static_folder = current_app.static_folder
    
    # Chemin complet du fichier demandé
    full_path = os.path.join(static_folder, path)
    
    # Si le fichier existe et n'est pas un dossier
    if path and os.path.exists(full_path) and not os.path.isdir(full_path):
        return send_from_directory(static_folder, path)
    
    # Sinon, retourne index.html
    return send_from_directory(static_folder, 'index.html')