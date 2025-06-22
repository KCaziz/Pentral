from flask import Flask 
import os
from db import get_db
from flask_cors import CORS
from flask_socketio import SocketIO
import sys
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet", allow_upgrades=True)


def create_app():
    # Chemin absolu vers le dossier static
    static_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/'))
    
    app = Flask(__name__,
               static_folder=static_path,
               static_url_path='')
    
    
    CORS(app, resources={r"/*": {"origins": "*"}})

    print("PYTHON EXECUTABLE:", sys.executable)

    from .routes.core import core_bp
    app.register_blueprint(core_bp)
    
    socketio.init_app(app) 

    return app