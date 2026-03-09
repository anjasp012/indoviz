import geopandas as gpd
import pandas as pd

gdf = gpd.read_file(r"C:\data\Bandung_PNBT_MERGED.shp")

gdf = gdf[gdf["kecamatan"] == "Babakan Ciparay"]

gdf["predicted"] = pd.to_numeric(gdf["predicted"], errors="coerce")
gdf["luasbidang"] = pd.to_numeric(gdf["luasbidang"], errors="coerce")

gdf = gdf.dropna(subset=["predicted","luasbidang"])

# harga per meter
gdf["price_m2"] = gdf["predicted"] / gdf["luasbidang"]

gdf = gdf.to_crs(4326)

gdf["geometry"] = gdf["geometry"].simplify(0.0001)

gdf.to_parquet(r"C:\data\babakan_ciparay.parquet", index=False)