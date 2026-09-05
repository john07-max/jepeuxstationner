SELECT normalized FROM imported_parking_rules
WHERE source_id='dialog' AND present AND active
 AND valid_during && tstzrange($3::timestamptz,$4::timestamptz,'[)')
 AND (
  (GeometryType(geometry) IN ('POLYGON','MULTIPOLYGON') AND ST_Covers(geometry,ST_SetSRID(ST_MakePoint($1,$2),4326)))
  OR (GeometryType(geometry) IN ('POINT','LINESTRING') AND ST_DWithin(geometry::geography,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$5))
 ) ORDER BY external_id;
