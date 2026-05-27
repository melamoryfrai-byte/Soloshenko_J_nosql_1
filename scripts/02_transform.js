// scripts/03_transform.js
// Run:
// mongosh "$env:MONGO_URI" --file scripts/03_transform.js

const dbName = "spotify_analytics";

const sourceCollection = "tracks_raw";
const targetCollection = "tracks";

const dbRef = db.getSiblingDB(dbName);

dbRef[targetCollection].drop();

dbRef[sourceCollection].aggregate([
  {
    $project: {
      _id: 0,
      track_id: 1,
      track_name: 1,
      album_name: 1,
      explicit: 1,
      popularity: 1,
      duration_ms: 1,
      track_genre: 1,

      artists: {
        $map: {
          input: { $split: ["$artists", ";"] },
          as: "artist",
          in: { $trim: { input: "$$artist" } }
        }
      },

      audio_features: {
        danceability: "$danceability",
        energy: "$energy",
        key: "$key",
        loudness: "$loudness",
        mode: "$mode",
        speechiness: "$speechiness",
        acousticness: "$acousticness",
        instrumentalness: "$instrumentalness",
        liveness: "$liveness",
        valence: "$valence",
        tempo: "$tempo",
        time_signature: "$time_signature"
      },
      
      duration_sec: {
        $round: [{ $divide: ["$duration_ms", 1000] }, 1]
      },

      popularity_tier: {
        $switch: {
          branches: [
            { case: { $gte: ["$popularity", 70] }, then: "high" },
            { case: { $gte: ["$popularity", 40] }, then: "medium" }
          ],
          default: "low"
        }
      }      
    }
  },
  {
    $out: targetCollection
  }
]);

print(`Created collection: ${dbName}.${targetCollection}`);
print(`Documents in ${targetCollection}: ${dbRef[targetCollection].countDocuments()}`);
print("Example document:");
printjson(dbRef[targetCollection].findOne());