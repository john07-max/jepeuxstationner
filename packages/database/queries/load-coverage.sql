-- $1 city, $2 exact zone, $3 start, $4 end. Coverage remains explicitly bounded.
SELECT c.complete, lower(c.valid_during) AS period_start, upper(c.valid_during) AS period_end,
 s.id AS source_id, s.adapter_id, s.authority, s.kind, s.reference, s.version,
 s.synthetic, s.observed_at, s.fresh_until
FROM source_coverage c JOIN data_sources s ON s.id=c.source_id
WHERE c.city_id=$1 AND c.zone_id=$2
 AND c.valid_during @> tstzrange($3::timestamptz,$4::timestamptz,'[)')
ORDER BY s.adapter_id,c.id;
