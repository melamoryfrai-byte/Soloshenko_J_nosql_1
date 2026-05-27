// queries/part4_indexes.js
// Run:
// $env:MONGO_URI = (Get-Content .env | Where-Object { $_ -match '^MONGO_URI=' }) -replace '^MONGO_URI=', ''
// mongosh "$env:MONGO_URI" --file queries/part4_indexes.js

const dbName = "spotify_analytics";
const dbRef = db.getSiblingDB(dbName);

print("\n=== Part 4: Indexes and Optimization ===");

// for debug purpose
const RUN_TASK_1 = true;
const RUN_TASK_2 = true;
const RUN_TASK_3 = true;

// ------------------------------------------------------------
// Завдання 1. Аналіз запиту та індексація
// ------------------------------------------------------------

if (RUN_TASK_1) {
  print("\n--- Task 1: Query analysis and indexing ---");

  const indexName = "idx_genre_danceability_popularity";

  const queryFilter = {
    track_genre: "pop",
    "audio_features.danceability": { $gte: 0.7 }
  };

  const querySort = {
    popularity: -1
  };

  print("\nDropping index if exists:");
  try {
    dbRef.tracks.dropIndex(indexName);
    print(`Dropped index: ${indexName}`);
  } catch (e) {
    print(`Index ${indexName} does not exist or cannot be dropped`);
  }

  print("\nExplain before index:");
  printjson(
    dbRef.tracks
      .find(queryFilter)
      .sort(querySort)
      .explain("executionStats")
  );

  print("\nCreating index:");
  dbRef.tracks.createIndex(
    {
      track_genre: 1,
      "audio_features.danceability": 1,
      popularity: -1
    },
    {
      name: indexName
    }
  );

  print("\nExplain after index:");
  printjson(
    dbRef.tracks
      .find(queryFilter)
      .sort(querySort)
      .explain("executionStats")
  );
}

// ------------------------------------------------------------
// Завдання 2. Індекс для інших полів
// ------------------------------------------------------------

if (RUN_TASK_2) {
  print("\n--- Task 2: Index for background work query ---");

  const indexName = "idx_explicit_instrumentalness_speechiness";

  const backgroundFilter = {
    explicit: false,
    "audio_features.instrumentalness": { $gt: 0.5 },
    "audio_features.speechiness": { $lt: 0.1 }
  };

  try {
    dbRef.tracks.dropIndex(indexName);
    print(`Dropped index: ${indexName}`);
  } catch (e) {
    print(`Index ${indexName} does not exist or cannot be dropped`);
  }

  print("\nExplain before index:");
  printjson(
    dbRef.tracks
      .find(backgroundFilter)
      .explain("executionStats")
  );

  print("\nCreating index:");
  dbRef.tracks.createIndex(
    {
      explicit: 1,
      "audio_features.instrumentalness": 1,
      "audio_features.speechiness": 1
    },
    {
      name: indexName
    }
  );

  print("\nExplain after index:");
  printjson(
    dbRef.tracks
      .find(backgroundFilter)
      .explain("executionStats")
  );
}

// ------------------------------------------------------------
// Завдання 3. Покривний запит
// ------------------------------------------------------------

if (RUN_TASK_3) {
  print("\n--- Task 3: Covered query check ---");

  const queryFilter = {
    track_genre: "pop",
    popularity: { $gte: 70 }
  };

  print("\nOriginal query explain:");
  printjson(
    dbRef.tracks
      .find(queryFilter)
      .explain("executionStats")
  );

  print("\nCovered-style query with projection:");
  printjson(
    dbRef.tracks
      .find(
        queryFilter,
        {
          _id: 0,
          track_genre: 1,
          popularity: 1
        }
      )
      .explain("executionStats")
  );
}