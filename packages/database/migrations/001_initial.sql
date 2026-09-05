BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TYPE parking_effect AS ENUM ('ALLOWED','FORBIDDEN','CONDITIONAL');
CREATE TYPE source_authority AS ENUM ('OFFICIAL','SECONDARY');
CREATE TABLE cities (
 id text PRIMARY KEY, name text NOT NULL, timezone text NOT NULL,
 boundary geometry(MultiPolygon,4326) NOT NULL,
 CHECK (NOT ST_IsEmpty(boundary) AND ST_IsValid(boundary))
);
CREATE TABLE parking_zones (
 id text PRIMARY KEY, city_id text NOT NULL REFERENCES cities(id),
 label text NOT NULL, curb_side text NOT NULL CHECK (curb_side IN ('LEFT','RIGHT','BOTH','UNKNOWN')),
 area geometry(MultiPolygon,4326) NOT NULL,
 UNIQUE (id,city_id), CHECK (NOT ST_IsEmpty(area) AND ST_IsValid(area))
);
CREATE INDEX parking_zones_area_gist ON parking_zones USING gist(area);
CREATE TABLE data_sources (
 id text PRIMARY KEY, adapter_id text NOT NULL, authority source_authority NOT NULL,
 kind text NOT NULL CHECK (kind IN ('SIGNAGE','ORDER','DATASET')),
 reference text NOT NULL CHECK (length(reference)>0), version text NOT NULL CHECK (length(version)>0),
 synthetic boolean NOT NULL DEFAULT false, observed_at timestamptz NOT NULL,
 fresh_until timestamptz NOT NULL, CHECK (observed_at<fresh_until), UNIQUE(id,adapter_id)
);
CREATE TABLE parking_rules (
 id text PRIMARY KEY, city_id text NOT NULL, zone_id text NOT NULL,
 source_id text NOT NULL REFERENCES data_sources(id),
 effect parking_effect NOT NULL, conditions text[] NOT NULL DEFAULT '{}',
 valid_during tstzrange NOT NULL,
 FOREIGN KEY(zone_id,city_id) REFERENCES parking_zones(id,city_id),
 CHECK (NOT isempty(valid_during) AND NOT lower_inf(valid_during) AND NOT upper_inf(valid_during) AND lower_inc(valid_during) AND NOT upper_inc(valid_during)),
 CHECK ((effect='CONDITIONAL' AND cardinality(conditions)>0) OR (effect<>'CONDITIONAL' AND cardinality(conditions)=0))
);
CREATE INDEX parking_rules_zone_idx ON parking_rules(zone_id);
CREATE INDEX parking_rules_period_gist ON parking_rules USING gist(valid_during);
CREATE TABLE source_coverage (
 id text PRIMARY KEY, city_id text NOT NULL, zone_id text NOT NULL,
 source_id text NOT NULL REFERENCES data_sources(id), complete boolean NOT NULL DEFAULT false,
 valid_during tstzrange NOT NULL,
 FOREIGN KEY(zone_id,city_id) REFERENCES parking_zones(id,city_id),
 CHECK (NOT isempty(valid_during) AND NOT lower_inf(valid_during) AND NOT upper_inf(valid_during) AND lower_inc(valid_during) AND NOT upper_inc(valid_during))
);
CREATE INDEX source_coverage_period_gist ON source_coverage USING gist(valid_during);
COMMENT ON TABLE source_coverage IS 'Explicit ingestion completeness; presence of rules does not establish coverage.';
-- No table stores users, submitted addresses or exact search coordinates.
INSERT INTO schema_migrations(version) VALUES (1);
COMMIT;
