BEGIN;
INSERT INTO cities VALUES ('test-city','Ville fictive','Europe/Paris',ST_Multi(ST_GeomFromText('POLYGON((0 0,2 0,2 2,0 2,0 0))',4326)));
INSERT INTO parking_zones VALUES ('test-zone','test-city','Zone fictive','RIGHT',ST_Multi(ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 1,0 0))',4326)));
INSERT INTO data_sources VALUES ('test-source','fixture','OFFICIAL','ORDER','fixture://test','1',true,'2026-09-01T00:00:00Z','2026-10-01T00:00:00Z');
INSERT INTO parking_rules VALUES ('test-rule','test-city','test-zone','test-source','ALLOWED','{}','[2026-09-05 12:00Z,2026-09-05 14:00Z)');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM parking_zones WHERE ST_Covers(area,ST_SetSRID(ST_MakePoint(0,0),4326))) THEN RAISE EXCEPTION 'Boundary missing'; END IF;
 IF EXISTS(SELECT 1 FROM parking_zones WHERE ST_Covers(area,ST_SetSRID(ST_MakePoint(3,3),4326))) THEN RAISE EXCEPTION 'Outside matched'; END IF;
 BEGIN
  INSERT INTO parking_rules VALUES ('bad','test-city','test-zone','missing','ALLOWED','{}','[2026-09-05 12:00Z,2026-09-05 14:00Z)');
  RAISE EXCEPTION 'Missing source accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  INSERT INTO parking_rules VALUES ('bad','test-city','test-zone','test-source','CONDITIONAL','{}','[2026-09-05 12:00Z,2026-09-05 14:00Z)');
  RAISE EXCEPTION 'Empty conditions accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
