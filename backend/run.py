from app import create_app
from db import get_db

app = create_app()

if __name__ == '__main__':
    print(f"Static folder: {app.static_folder}") 
    app.run( host='0.0.0.0', port=5000, debug=False, threaded=True, use_reloader=True)
    