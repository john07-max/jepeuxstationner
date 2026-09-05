CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
SELECT pg_temp.assert_true(ST_Covers(ST_MakeEnvelope(4,44,4.01,44.01,4326),ST_SetSRID(ST_MakePoint(4.005,44.005),4326)),'point inside Polygon');
SELECT pg_temp.assert_true(NOT ST_Covers(ST_MakeEnvelope(4,44,4.01,44.01,4326),ST_SetSRID(ST_MakePoint(4.1,44.1),4326)),'point outside Polygon');
SELECT pg_temp.assert_true(ST_Covers(area,ST_SetSRID(ST_MakePoint(4,44.005),4326)),'boundary ST_Covers') FROM parking_zones WHERE id='ci-active';
SELECT pg_temp.assert_true(ST_SRID(area)=4326,'stored SRID 4326') FROM parking_zones WHERE id='ci-active';
SELECT pg_temp.assert_true(ST_Covers(area,ST_SetSRID(ST_MakePoint(4.005,44.005),4326)) AND NOT ST_Covers(area,ST_SetSRID(ST_MakePoint(44.005,4.005),4326)),'longitude is X; latitude is Y') FROM parking_zones WHERE id='ci-active';
SELECT pg_temp.assert_true(ST_NumGeometries(area)=2 AND ST_Covers(area,ST_SetSRID(ST_MakePoint(4.505,44.005),4326)) AND ST_Covers(area,ST_SetSRID(ST_MakePoint(4.525,44.005),4326)),'MultiPolygon both components') FROM parking_zones WHERE id='ci-multi';
SELECT pg_temp.assert_true((SELECT count(*) FROM parking_zones WHERE city_id='ci-city' AND ST_Covers(area,ST_SetSRID(ST_MakePoint(5.015,44.015),4326)))=2,'overlap preserves both matches');
DO $$ BEGIN
 BEGIN
  INSERT INTO parking_zones VALUES ('ci-invalid','ci-city','invalid','RIGHT',ST_Multi(ST_GeomFromText('POLYGON((4 44,4.01 44.01,4.01 44,4 44.01,4 44))',4326)));
  RAISE EXCEPTION 'FAIL: invalid geometry accepted';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: invalid geometry rejected'; END;
 BEGIN
  INSERT INTO parking_zones VALUES ('ci-srid','ci-city','wrong SRID','RIGHT',ST_Multi(ST_MakeEnvelope(4,44,4.01,44.01,3857)));
  RAISE EXCEPTION 'FAIL: wrong SRID accepted';
 EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'PASS: wrong SRID rejected'; END;
END $$;
