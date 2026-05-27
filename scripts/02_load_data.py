import os
from pathlib import Path
from tqdm import tqdm
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv()

MONGO_URI = os.environ["MONGO_URI"]
DB_NAME = "spotify_analytics"
COLLECTION_NAME = "tracks_raw"

CSV_PATH = Path("/Users/julia/Desktop - Julia’s Home MacBook Pro_)/master degree /DataBases: No SQl /NoSql_Soloshenko_1h:m/Soloshenko_J_nosql_1/data/raw/dataset.csv")
BATCH_SIZE = 1000


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV file not found: {CSV_PATH}")

    print(f"Reading CSV file: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)

    print(f"Rows in CSV: {len(df)}")
    print(f"Columns in CSV: {len(df.columns)}")

    # Remove technical index column from Kaggle CSV export
    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])

    # Remove records without artist or track name
    df = df.dropna(subset=["artists", "track_name"])

    # Convert types explicitly
    df["explicit"] = df["explicit"].astype(bool)

    int_cols = ["popularity", "duration_ms", "key", "mode", "time_signature"]
    for col in int_cols:
        df[col] = df[col].astype(int)

    float_cols = [
        "danceability",
        "energy",
        "loudness",
        "speechiness",
        "acousticness",
        "instrumentalness",
        "liveness",
        "valence",
        "tempo",
    ]
    for col in float_cols:
        df[col] = df[col].astype(float)

    records = df.to_dict("records")

    client = MongoClient(MONGO_URI)

    try:
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]

        # Drop collection for idempotent re-run
        collection.drop()

        print(f"Uploading {len(records)} tracks to {DB_NAME}.{COLLECTION_NAME}...")

        for i in tqdm(range(0, len(records), BATCH_SIZE)):
            batch = records[i : i + BATCH_SIZE]
            collection.insert_many(batch)

        print(f"Uploaded documents: {collection.count_documents({})}")
        print("Example document:")
        print(collection.find_one())

    finally:
        client.close()


if __name__ == "__main__":
    main()