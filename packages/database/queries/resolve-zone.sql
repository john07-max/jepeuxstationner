-- Parameters: $1 longitude, $2 latitude, $3 city id.
-- Caller MUST require exactly one result AND a confirmed curb side.
-- A boundary shared by two zones is ambiguous, never choose LIMIT 1.
SELECT id, curb_side FROM parking_zones
WHERE city_id=$3 AND ST_Covers(area,ST_SetSRID(ST_MakePoint($1,$2),4326));
