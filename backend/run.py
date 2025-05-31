import eventlet
eventlet.monkey_patch()
from app import create_app, socketio
from db import get_db

app = create_app()

if __name__ == '__main__':
    print(f"Static folder: {app.static_folder}") 
    # app.run( host='0.0.0.0', port=5000, debug=False, threaded=True, use_reloader=True)
    socketio.run(app, host='0.0.0.0', port=5000)