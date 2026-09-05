-- A real 40,000-row grid; no SET enable_seqscan / planner hints.
INSERT INTO cities VALUES ('plan-city','Ville fictive plan','Europe/Paris',ST_Multi(ST_MakeEnvelope(-2,41,0,43,4326)));
INSERT INTO parking_zones
SELECT 'plan-'||x||'-'||y,'plan-city','Plan fixture','RIGHT',
 ST_Multi(ST_MakeEnvelope(-2+x*0.01,41+y*0.01,-2+x*0.01+0.009,41+y*0.01+0.009,4326))
FROM generate_series(0,199) AS x CROSS JOIN generate_series(0,199) AS y;
ANALYZE parking_zones;
