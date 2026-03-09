import geopandas as gpd

# lokasi shapefile
shp_path = r"C:\data\Bandung_PNBT_MERGED.shp"

# baca shapefile
gdf = gpd.read_file(shp_path)

print("Kolom data:")
print(gdf.columns)

# ubah koordinat agar cocok dengan web map
gdf = gdf.to_crs(4326)

# pastikan kolom harga bertipe numerik
gdf["predicted"] = gdf["predicted"].astype(float)

# simpan sebagai GeoParquet
output = r"C:\data\Bandung_PNBT_MERGED.parquet"
gdf.to_parquet(output)

print("Konversi selesai!")
print("Output:", output)