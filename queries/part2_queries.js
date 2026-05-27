// queries/part2_queries.js
// Run:
// $env:MONGO_URI = (Get-Content .env | Where-Object { $_ -match '^MONGO_URI=' }) -replace '^MONGO_URI=', ''
// mongosh "$env:MONGO_URI" --file queries/part2_queries.js

const dbName = "spotify_analytics";
const dbRef = db.getSiblingDB(dbName);

print("\n=== Part 2: Queries ===");

// ------------------------------------------------------------
// Завдання 1. Треки для вечірки

// danceability > 0.7
// energy > 0.7
// duration_ms від 180000 до 300000
// ------------------------------------------------------------

// запит повертає велику кількість треків
// тому переробив на топ 10 за найбільш популярних
// окремо рахую загальну кількість треків

// ------------------------------------------------------------
// Завдання 1. Треки для вечірки

// danceability > 0.7
// energy > 0.7
// duration_sec від 180 до 300
// ------------------------------------------------------------

// for debug purpose
const RUN_TASK_1 = true;
const RUN_TASK_2 = true;
const RUN_TASK_3 = true;
const RUN_TASK_4 = true;

if (RUN_TASK_1) {
    print("\n--- Task 1: Party tracks ---");

    const minDanceability = 0.7;
    const minEnergy = 0.7;
    const minDuration_sec = 180;    
    const maxDuration_sec = 300;    

    const partyTracksFilter = {
    "audio_features.danceability": { $gt: minDanceability },
    "audio_features.energy": { $gt: minEnergy },
    duration_sec: {
        $gte: minDuration_sec,
        $lte: maxDuration_sec
    }
    };

    const partyTracksProjection = {
    _id: 0,
    track_name: 1,
    artists: 1,
    popularity: 1,
    popularity_tier: 1,
    duration_sec: 1
    };

    print(`Matched documents: ${dbRef.tracks.countDocuments(partyTracksFilter)}`);
    print("Showing first 10 documents sorted by popularity desc:");

    dbRef.tracks
    .find(partyTracksFilter, partyTracksProjection)
    .sort({ popularity: -1, track_name: 1 })
    .limit(10)
    .forEach(printjson);
}

// ------------------------------------------------------------
// Завдання 2. Виконавці, у яких усі треки популярні

// artist has at least 3 tracks
// minimum popularity >= 60
// output top-20:
// artist, track_count, min_popularity, avg_popularity
// ------------------------------------------------------------

if (RUN_TASK_2) {
    print("\n--- Task 2: Artists with all popular tracks ---");
  
    const minTracksPerArtist = 3;
    const minTrackPopularity = 60;
    const topArtistsLimit = 20;
  
    const popularArtistsPipeline = [
      // split array of artists into separate documents
      {
        $unwind: "$artists"
      },
  
      // group by artist
      {
        $group: {
          _id: "$artists",
          tracksCount: { $sum: 1 },
          minPopularity: { $min: "$popularity" },
          avgPopularity: { $avg: "$popularity" }
        }
      },
  
      // filter artists with at least 3 tracks and min popularity >= 60
      {
        $match: {
          tracksCount: { $gte: minTracksPerArtist },
          minPopularity: { $gte: minTrackPopularity }
        }
      },
  
      // project final fields
      {
        $project: {
          _id: 0,
          artist: "$_id",
          tracksCount: 1,
          minPopularity: 1,
          avgPopularity: { $round: ["$avgPopularity", 1] }
        }
      },
  
      // sort by avg popularity desc, then track count desc
      {
        $sort: {
          avgPopularity: -1,
          tracksCount: -1,
          artist: 1 // stable sorting for equal values
        }
      },
  
      // limit to top 20
      {
        $limit: topArtistsLimit
      }
    ];
  
    dbRef.tracks.aggregate(popularArtistsPipeline).forEach(printjson);
  }
// ------------------------------------------------------------
// Завдання 3. Нетипові треки
// Алгоритм:
// 1. for each genre calculate avg tempo and stdDevPop tempo
// 2. threshold = avg tempo + 2 * stdDev
// 3. find tracks where tempo > threshold
// output per genre:
// avg_tempo, genre, outlier_threshold, outlier_tracks
// ------------------------------------------------------------

if (RUN_TASK_3) {
    print("\n--- Task 3: Tempo outliers by genre ---");
  
    const outlierMultiplier = 2;
    const maxGenresToShow = 10;
    const maxOutlierTracksPerGenre = 5;
  
    const tempoOutliersBasePipeline = [
      // 1. Calculate genre-level tempo statistics for each track.
      // This works like SQL window functions:
      // AVG(tempo) OVER (PARTITION BY track_genre)
      // STDDEV_POP(tempo) OVER (PARTITION BY track_genre)
      {
        $setWindowFields: {
          partitionBy: "$track_genre",
          output: {
            avgTempo: {
              $avg: "$audio_features.tempo"
            },
            stdDevTempo: {
              $stdDevPop: "$audio_features.tempo"
            }
          }
        }
      },
  
      // 2. Calculate the outlier threshold for each track's genre.
      // Formula: avg tempo of genre + 2 * standard deviation of genre.
      {
        $addFields: {
          outlierThreshold: {
            $add: [
              "$avgTempo",
              { $multiply: [outlierMultiplier, "$stdDevTempo"] }
            ]
          }
        }
      },
  
      // 3. Keep only tracks whose tempo is higher than the genre-specific threshold.
      // $expr is required because we compare one document field with another calculated field.
      {
        $match: {
          $expr: {
            $gt: [
              "$audio_features.tempo",
              "$outlierThreshold"
            ]
          }
        }
      },
      
      // Sort outlier tracks before grouping so that the first tracks
      // in each outlier_tracks array have the highest tempo.
      {
        $sort: {
            track_genre: 1,
            "audio_features.tempo": -1
        }
      },    
  
      // 4. Group outlier tracks back by genre.
      // The genre statistics are the same within each genre, so $first is sufficient.
      {
        $group: {
          _id: "$track_genre",
          avgTempo: { $first: "$avgTempo" },
          outlierThreshold: { $first: "$outlierThreshold" },
          outlierTracks: {
            $push: {
              track_name: "$track_name",
              popularity: "$popularity",
              artists: "$artists",
              audio_features: {
                tempo: "$audio_features.tempo"
              }
            }
          }
        }
      },
  
      // 5. Add outlier count per genre.
      {
        $addFields: {
          outlierCount: { $size: "$outlierTracks" }
        }
      }
    ];
  
    const tempoOutlierGenresCount = dbRef.tracks.aggregate([
      ...tempoOutliersBasePipeline,
      { $count: "genresWithOutliers" }
    ]).toArray();
  
    print(
      `Genres with tempo outliers: ${tempoOutlierGenresCount[0]?.genresWithOutliers ?? 0}`
    );
  
    print(
      `Showing first ${maxGenresToShow} genres, up to ${maxOutlierTracksPerGenre} tracks per genre:`
    );
  
    const tempoOutliersDisplayPipeline = [
      ...tempoOutliersBasePipeline,
  
      // 6. Format the final output according to the task requirements.
      // The full outlier count is preserved, but only a few tracks are printed for readability.
      {
        $project: {
          _id: 0,
          genre: "$_id",
          avg_tempo: { $round: ["$avgTempo", 1] },
          outlier_threshold: { $round: ["$outlierThreshold", 1] },
          outlier_count: "$outlierCount",
          outlier_tracks: {
            $slice: ["$outlierTracks", maxOutlierTracksPerGenre]
          }
        }
      },
  
      // 7. Sort genres by number of outliers, then by genre name for stable output.
      {
        $sort: {
          outlier_count: -1,
          genre: 1
        }
      },
  
      // 8. Limit output for readability in the terminal.
      {
        $limit: maxGenresToShow
      }
    ];
  
    dbRef.tracks.aggregate(tempoOutliersDisplayPipeline).forEach(printjson);
}

// ------------------------------------------------------------
// Завдання 4. Треки для фонової роботи
// Умови:
// loudness < -10
// speechiness < 0.1
// instrumentalness > 0.5
// explicit = false
// ------------------------------------------------------------

if (RUN_TASK_4) {

    print("\n--- Task 4: Background work tracks ---");

    const maxLoudness = -10;
    const maxSpeechiness = 0.1;
    const minInstrumentalness = 0.5;    

    const backgroundTracksFilter = {
        "audio_features.loudness": { $lt: maxLoudness },
        "audio_features.speechiness": { $lt: maxSpeechiness },
        "audio_features.instrumentalness": { $gt: minInstrumentalness },
        explicit: false
    };
    
    const backgroundTracksProjection = {
        _id: 0,
        track_name: 1,
        artists: 1,
        track_genre: 1,
        duration_sec: 1,
        popularity: 1,
        popularity_tier: 1,
        "audio_features.loudness": 1,
        "audio_features.speechiness": 1,
        "audio_features.instrumentalness": 1,
        explicit: 1
    };
    
    print(`Matched documents: ${dbRef.tracks.countDocuments(backgroundTracksFilter)}`);
    print("Showing first 10 documents sorted by popularity desc:");
    
    dbRef.tracks
        .find(backgroundTracksFilter, backgroundTracksProjection)
        .sort({ popularity: -1, track_name: 1 })
        .limit(10)
        .forEach(printjson);
}