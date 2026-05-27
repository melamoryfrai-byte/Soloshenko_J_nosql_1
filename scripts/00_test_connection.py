import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

mongo_uri = os.environ["MONGO_URI"]

client = MongoClient(mongo_uri)

try:
    client.admin.command("ping")
    print("✅ MongoDB connection successful")

    db = client["spotify_analytics"]
    print("Database selected:", db.name)

finally:
    client.close()