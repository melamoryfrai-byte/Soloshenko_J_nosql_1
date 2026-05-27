from pathlib import Path
import pandas as pd

DATA_PATH = Path("/Users/julia/Desktop - Julia’s Home MacBook Pro_)/master degree /DataBases: No SQl /NoSql_Soloshenko_1h:m/Soloshenko_J_nosql_1/data")

df = pd.read_csv(DATA_PATH)

print("Shape:", df.shape)
print("\nColumns:")
for col in df.columns:
    print("-", col)

print("\nFirst 3 rows:")
print(df.head(3).to_string())

missing_required = df[df["artists"].isna() | df["track_name"].isna()]

print("Rows with missing artists or track_name:", len(missing_required))
print(missing_required.to_string())