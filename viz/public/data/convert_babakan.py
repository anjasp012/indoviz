import geopandas as gpd

# baca shapefile
gdf = gpd.read_file(r"C:\data\Bandung_PNBT_MERGED.shp")

# filter kecamatan
gdf = gdf[gdf["kecamatan"] == "Babakan Ciparay"]

print("Jumlah bidang:", len(gdf))

# simplify geometry supaya lebih ringan
gdf["geometry"] = gdf["geometry"].simplify(1)

# simpan sebagai GeoParquet
gdf.to_parquet(r"C:\data\babakan_ciparay.parquet")

print("File GeoParquet berhasil dibuat")