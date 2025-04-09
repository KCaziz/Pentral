from flask import Flask
import os

def create_app():
    # Chemin absolu vers le dossier static
    static_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/dist'))
    
    app = Flask(__name__,
               static_folder=static_path,
               static_url_path='')
    
    # Configuration CORS si nécessaire
    from flask_cors import CORS
    CORS(app)

    # Enregistrement des Blueprints
    from .routes.core import core_bp
    app.register_blueprint(core_bp)

    return app