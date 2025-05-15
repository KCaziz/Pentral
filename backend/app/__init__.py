from flask import Flask
import os
from db import get_db
from flask_cors import CORS


def create_app():
    # Chemin absolu vers le dossier static
    static_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/'))
    
    
    app = Flask(__name__,
               static_folder=static_path,
               static_url_path='')
    
    
    CORS(app, resources={r"/*": {"origins": "*"}})
    # Enable CORS
#     CORS(app, resources={r"/*": {"origins": "*"}})
#     CORS(app, resources={
#   r"/api/*": {
#     "origins": ["http://localhost:3000","http://127.0.0.1:3000", "https://votre-domaine.com"],
#     "methods": ["GET", "POST", "PUT", "DELETE"],
#     "allow_headers": ["Content-Type"]
#   }
# })
    
    # Enregistrement des Blueprints
    from .routes.core import core_bp
    app.register_blueprint(core_bp)

    return app