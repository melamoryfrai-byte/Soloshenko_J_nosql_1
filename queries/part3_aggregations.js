// queries/part3_aggregations.js
// Run:
// $env:MONGO_URI = (Get-Content .env | Where-Object { $_ -match '^MONGO_URI=' }) -replace '^MONGO_URI=', ''
// mongosh "$env:MONGO_URI" --file queries/part3_aggregations.js

const dbName = "spotify_analytics";
const dbRef = db.getSiblingDB(dbName);

print("\n=== Part 3: Aggregation Pipeline Analytics ===");

// for debug purpose
const RUN_TASK_1 = true;
const RUN_TASK_2 = true;
const RUN_TASK_3 = true;

// ------------------------------------------------------------
// Завдання 1. Топ-10 виконавців за середньою популярністю
// Умови:
// artist has at least 5 tracks
// calculate average popularity
// sort by avg popularity desc
// output top-10
// ------------------------------------------------------------

if (RUN_TASK_1) {
  print("\n--- Task 1: Top-10 artists by average popularity ---");

  const minTracksPerArtist = 5;
  const topArtistsLimit = 10;

  const topArtistsByAvgPopularityPipeline = [
    // unwind artists
    {
        $unwind: "$artists"
    },

    // group by artist
    {
        $group: {
            _id: "$artists",
            tracksCount: { $sum: 1 },
            avgPopularity: { $avg: "$popularity" }
        }
    },
    
    // keep artists with at least 5 tracks
    {
        $match: {
          tracksCount: { $gte: minTracksPerArtist }
        }
    },

    // project artist, track_count, avg_popularity
    {
        $project: {
          _id: 0,
          artist: "$_id",
          tracksCount: 1,
          avgPopularity: { $round: ["$avgPopularity", 1] }
        }
      },    

    // sort by avg_popularity desc
    {
        $sort: {
          avgPopularity: -1,
          tracksCount: -1,
          artist: 1 // stable sorting for equal values
        }
    },    

    // limit to top 10
    {
        $limit: topArtistsLimit
    }    
  ];

  dbRef.tracks.aggregate(topArtistsByAvgPopularityPipeline).forEach(printjson);
}

// ------------------------------------------------------------
// Завдання 2. Розподіл треків за настроєм
// Умови:
// high valence + high energy -> happy
// low valence + high energy  -> angry
// high valence + low energy  -> calm
// low valence + low energy   -> sad
// ------------------------------------------------------------

if (RUN_TASK_2) {
  print("\n--- Task 2: Track distribution by mood ---");

  const valenceThreshold = 0.5;
  const energyThreshold = 0.5;

  const moodDistributionPipeline = [
    // add mood field using $switch
    {
        $addFields: {
          mood: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [
                      { $gte: ["$audio_features.valence", valenceThreshold] },
                      { $gte: ["$audio_features.energy", energyThreshold] }
                    ]
                  },
                  then: "happy"
                },
                {
                  case: {
                    $and: [
                      { $lt: ["$audio_features.valence", valenceThreshold] },
                      { $gte: ["$audio_features.energy", energyThreshold] }
                    ]
                  },
                  then: "angry"
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$audio_features.valence", valenceThreshold] },
                      { $lt: ["$audio_features.energy", energyThreshold] }
                    ]
                  },
                  then: "calm"
                },
                {
                  case: {
                    $and: [
                      { $lt: ["$audio_features.valence", valenceThreshold] },
                      { $lt: ["$audio_features.energy", energyThreshold] }
                    ]
                  },
                  then: "sad"
                }
              ],
              default: "unknown"
            }
          }
        }
    },

    // group by mood and count tracks
    {
        $group: {
          _id: "$mood",
          tracksCount: { $sum: 1 }
        }
    },

    // project mood and track_count
    {
        $project: {
          _id: 0,
          mood: "$_id",
          tracksCount: 1
        }
    },

    // sort by track_count desc
    {
        $sort: {
          tracksCount: -1
        }
    }    
  ];

  dbRef.tracks.aggregate(moodDistributionPipeline).forEach(printjson);
}

// ------------------------------------------------------------
// Завдання 3. Найбільш “танцювальний” жанр
// Умови:
// group by genre
// calculate avg danceability, avg energy, avg valence
// filter genres with at least 100 tracks
// output genre, averages, track count
// ------------------------------------------------------------

if (RUN_TASK_3) {
    print("\n--- Task 3: Most danceable genres ---");
  
    const minTracksPerGenre = 100;
    const genresLimit = 10;
  
    const mostDanceableGenresPipeline = [
      // group by track_genre
      {
        $group: {
          _id: "$track_genre",
          avgDanceability: { $avg: "$audio_features.danceability" },
          avgEnergy: { $avg: "$audio_features.energy" },
          avgValence: { $avg: "$audio_features.valence" },
          tracksCount: { $sum: 1 }
        }
      },
  
      // filter genres with at least 100 tracks
      {
        $match: {
          tracksCount: { $gte: minTracksPerGenre }
        }
      },
  
      // project final fields
      {
        $project: {
          _id: 0,
          genre: "$_id",
          avgDanceability: { $round: ["$avgDanceability", 3] },
          avgEnergy: { $round: ["$avgEnergy", 3] },
          avgValence: { $round: ["$avgValence", 3] },
          tracksCount: 1
        }
      },
  
      // sort by average danceability desc
      {
        $sort: {
          avgDanceability: -1,
          avgEnergy: -1,
          avgValence: -1,
          genre: 1
        }
      },
  
      // show top genres only
      {
        $limit: genresLimit
      }
    ];
  
    print(`Showing top ${genresLimit} genres sorted by average danceability desc:`);
  
    dbRef.tracks.aggregate(mostDanceableGenresPipeline).forEach(printjson);
}