from pymongo import MongoClient

def get_db():
    try:
        # mongodb://monUser:monMotDePasse@localhost:27017/maBaseDeDonnees

        # client = MongoClient("mongodb+srv://aziz:elW7kwooNVipEwSf@pentral.yxpevbn.mongodb.net/?retryWrites=true&w=majority&appName=Pentral")  
        client = MongoClient("mongodb://aziz:aziz@localhost:27017/pentral")  
        db = client["Pentral"]
        
        print("Connexion MongoDB réussie. Bases existantes :", client.list_database_names())
 
        return db
    except Exception as e:
        print("Erreur de connexion à MongoDB :", e)
        raise
