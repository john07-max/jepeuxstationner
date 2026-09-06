SELECT normalized, observation, retrieved_at,
 ST_Distance(position::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS distance_meters
FROM parking_facilities
WHERE present AND normalized->>'publicAccess'='true'
 AND ST_DWithin(position::geography,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$3)
ORDER BY distance_meters,source_id,external_id
LIMIT $4;
