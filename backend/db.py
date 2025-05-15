from pymongo import MongoClient

def get_db():
    try:
        client = MongoClient("mongodb+srv://aziz:elW7kwooNVipEwSf@pentral.yxpevbn.mongodb.net/?retryWrites=true&w=majority&appName=Pentral")  
        db = client["Pentral"]
        
        print("Connexion MongoDB réussie. Bases existantes :", client.list_database_names())
 
        return db
    except Exception as e:
        print("Erreur de connexion à MongoDB :", e)
        raise
