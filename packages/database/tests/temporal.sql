CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
SELECT pg_temp.assert_true(valid_during @> '2026-09-05T12:30:00Z'::timestamptz,'active rule') FROM parking_rules WHERE zone_id='ci-active';
SELECT pg_temp.assert_true(NOT(valid_during && tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)')),'future rule does not overlap') FROM parking_rules WHERE zone_id='ci-future';
SELECT pg_temp.assert_true(NOT(valid_during && tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)')),'expired rule does not overlap') FROM parking_rules WHERE zone_id='ci-expired';
SELECT pg_temp.assert_true(upper_inf(valid_during) AND valid_during @> '2030-01-01T00:00:00Z'::timestamptz,'permanent rule with no end') FROM parking_rules WHERE zone_id='ci-permanent';
SELECT pg_temp.assert_true((SELECT count(*) FROM parking_rules WHERE zone_id='ci-successive')=3,'three successive changes');
SELECT pg_temp.assert_true((SELECT count(*) FROM parking_rules WHERE zone_id='ci-successive' AND valid_during @> '2026-09-05T12:30:00Z'::timestamptz AND effect='FORBIDDEN')=1,'half-open boundary selects new rule');
SELECT pg_temp.assert_true((SELECT count(*) FROM parking_rules WHERE zone_id='ci-successive' AND valid_during @> '2026-09-05T12:30:00Z'::timestamptz)=1,'no double application at boundary');
SELECT pg_temp.assert_true(fresh_until<='2026-09-05T12:00:00Z'::timestamptz,'stale source remains detectable') FROM data_sources WHERE id='ci-stale-source';
DO $$ BEGIN
 BEGIN
  INSERT INTO parking_rules VALUES ('ci-empty-period','ci-city','ci-active','ci-official','ALLOWED','{}','empty');
  RAISE EXCEPTION 'FAIL: empty period accepted';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: empty period rejected'; END;
 BEGIN
  INSERT INTO parking_rules VALUES ('ci-unbounded-start','ci-city','ci-active','ci-official','ALLOWED','{}','(,2026-09-05T14:00:00Z)');
  RAISE EXCEPTION 'FAIL: unknown effective start accepted';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: unknown effective start rejected'; END;
END $$;
