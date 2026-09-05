-- Synthetic-only fixture. Caller opens a transaction and rolls it back.
-- All scenarios use one fictional city and explicit EPSG:4326 (x=longitude,y=latitude).
INSERT INTO cities VALUES ('ci-city','Ville fictive CI','Europe/Paris',ST_Multi(ST_MakeEnvelope(3,43,6,46,4326)));
INSERT INTO parking_zones VALUES ('ci-active','ci-city','Fictif active','RIGHT',ST_Multi(ST_MakeEnvelope(4.00,44,4.01,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-transition','ci-city','Fictif transition','RIGHT',ST_Multi(ST_MakeEnvelope(4.02,44,4.03,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-missing','ci-city','Fictif missing','RIGHT',ST_Multi(ST_MakeEnvelope(4.04,44,4.05,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-allowed','ci-city','Fictif allowed','RIGHT',ST_Multi(ST_MakeEnvelope(4.06,44,4.07,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-conditional','ci-city','Fictif conditional','RIGHT',ST_Multi(ST_MakeEnvelope(4.08,44,4.09,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-conflict','ci-city','Fictif conflict','RIGHT',ST_Multi(ST_MakeEnvelope(4.10,44,4.11,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-secondary','ci-city','Fictif secondary','RIGHT',ST_Multi(ST_MakeEnvelope(4.12,44,4.13,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-stale','ci-city','Fictif stale','RIGHT',ST_Multi(ST_MakeEnvelope(4.14,44,4.15,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-expired','ci-city','Fictif expired','RIGHT',ST_Multi(ST_MakeEnvelope(4.16,44,4.17,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-future','ci-city','Fictif future','RIGHT',ST_Multi(ST_MakeEnvelope(4.18,44,4.19,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-permanent','ci-city','Fictif permanent','RIGHT',ST_Multi(ST_MakeEnvelope(4.20,44,4.21,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-successive','ci-city','Fictif successive','RIGHT',ST_Multi(ST_MakeEnvelope(4.22,44,4.23,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-stale-coverage','ci-city','Fictif stale-coverage','RIGHT',ST_Multi(ST_MakeEnvelope(4.24,44,4.25,44.01,4326)));
INSERT INTO parking_zones VALUES ('ci-unknown-curb','ci-city','Fictif unknown-curb','UNKNOWN',ST_Multi(ST_MakeEnvelope(4.26,44,4.27,44.01,4326)));

INSERT INTO parking_zones VALUES
 ('ci-multi','ci-city','Fictif multi','RIGHT',ST_Multi(ST_Collect(ST_MakeEnvelope(4.5,44,4.51,44.01,4326),ST_MakeEnvelope(4.52,44,4.53,44.01,4326)))),
 ('ci-overlap-a','ci-city','Fictif overlap A','RIGHT',ST_Multi(ST_MakeEnvelope(5,44,5.02,44.02,4326))),
 ('ci-overlap-b','ci-city','Fictif overlap B','RIGHT',ST_Multi(ST_MakeEnvelope(5.01,44.01,5.03,44.03,4326)));
INSERT INTO data_sources VALUES
 ('ci-official','ci-adapter','OFFICIAL','ORDER','fixture://ci/order','1',true,'2026-09-01T00:00:00Z','2026-10-01T00:00:00Z'),
 ('ci-signage','ci-adapter','OFFICIAL','SIGNAGE','fixture://ci/signage','1',true,'2026-09-01T00:00:00Z','2026-10-01T00:00:00Z'),
 ('ci-secondary','ci-adapter','SECONDARY','DATASET','fixture://ci/secondary','1',true,'2026-09-01T00:00:00Z','2026-10-01T00:00:00Z'),
 ('ci-stale-source','ci-adapter','OFFICIAL','ORDER','fixture://ci/stale','1',true,'2026-08-01T00:00:00Z','2026-09-04T00:00:00Z');
INSERT INTO source_coverage
SELECT 'coverage-'||id,city_id,id,
 CASE WHEN id='ci-stale-coverage' THEN 'ci-stale-source' ELSE 'ci-official' END,
 true,tstzrange('2026-09-05T00:00:00Z','2026-09-06T00:00:00Z','[)')
FROM parking_zones WHERE city_id='ci-city' AND id<>'ci-missing';
INSERT INTO parking_rules VALUES ('ci-rule-0','ci-city','ci-active','ci-official','FORBIDDEN','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-1','ci-city','ci-transition','ci-official','ALLOWED','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T13:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-2','ci-city','ci-transition','ci-official','FORBIDDEN','{}',tstzrange('2026-09-05T13:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-3','ci-city','ci-allowed','ci-official','ALLOWED','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-4','ci-city','ci-conditional','ci-official','CONDITIONAL',ARRAY['Permis fictif requis'],tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-5','ci-city','ci-conflict','ci-official','ALLOWED','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-6','ci-city','ci-conflict','ci-signage','FORBIDDEN','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-7','ci-city','ci-secondary','ci-official','ALLOWED','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-8','ci-city','ci-secondary','ci-secondary','FORBIDDEN','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-9','ci-city','ci-stale','ci-stale-source','ALLOWED','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-10','ci-city','ci-expired','ci-official','FORBIDDEN','{}',tstzrange('2026-09-05T09:00:00Z','2026-09-05T11:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-11','ci-city','ci-future','ci-official','FORBIDDEN','{}',tstzrange('2026-09-05T15:00:00Z','2026-09-05T16:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-12','ci-city','ci-permanent','ci-official','ALLOWED','{}',tstzrange('2026-09-05T00:00:00Z',NULL,'[)'));
INSERT INTO parking_rules VALUES ('ci-rule-13','ci-city','ci-successive','ci-official','ALLOWED','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T12:30:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-14','ci-city','ci-successive','ci-official','FORBIDDEN','{}',tstzrange('2026-09-05T12:30:00Z','2026-09-05T13:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-15','ci-city','ci-successive','ci-official','ALLOWED','{}',tstzrange('2026-09-05T13:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-16','ci-city','ci-stale-coverage','ci-official','ALLOWED','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
INSERT INTO parking_rules VALUES ('ci-rule-17','ci-city','ci-multi','ci-official','ALLOWED','{}',tstzrange('2026-09-05T12:00:00Z','2026-09-05T14:00:00Z','[)'));
