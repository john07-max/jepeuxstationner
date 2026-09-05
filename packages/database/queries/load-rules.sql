-- $1 city, $2 exact zone, $3 start, $4 end, $5 adapter.
-- Clip to the finite evaluation window. Unbounded upper validity is permanent,
-- not stale: freshness is carried separately, untouched, to the engine.
SELECT r.id, r.city_id, r.zone_id, r.effect, r.conditions,
 greatest(lower(r.valid_during),$3::timestamptz) AS period_start,
 least(upper(r.valid_during),$4::timestamptz) AS period_end,
 s.id AS source_id, s.adapter_id, s.authority, s.kind, s.reference, s.version,
 s.synthetic, s.observed_at, s.fresh_until
FROM parking_rules r JOIN data_sources s ON s.id=r.source_id
WHERE r.city_id=$1 AND r.zone_id=$2 AND s.adapter_id=$5
 AND r.valid_during && tstzrange($3::timestamptz,$4::timestamptz,'[)')
ORDER BY lower(r.valid_during),r.id;
