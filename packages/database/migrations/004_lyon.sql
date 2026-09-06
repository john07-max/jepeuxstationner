BEGIN;
CREATE TABLE local_source_registry (
 id text PRIMARY KEY, metadata jsonb NOT NULL CHECK(jsonb_typeof(metadata)='object'), retrieved_at timestamptz NOT NULL
);
CREATE TABLE lyon_street_inventory (
 external_id text PRIMARY KEY, normalized jsonb NOT NULL, geometry geometry(MultiLineString,4326),
 eligible boolean NOT NULL, present boolean NOT NULL DEFAULT true, retrieved_at timestamptz NOT NULL,
 CHECK (geometry IS NULL OR (ST_IsValid(geometry) AND NOT ST_IsEmpty(geometry) AND
 ST_XMin(Box3D(geometry))>=-180 AND ST_XMax(Box3D(geometry))<=180 AND ST_YMin(Box3D(geometry))>=-90 AND ST_YMax(Box3D(geometry))<=90))
);
CREATE INDEX lyon_street_geometry_gist ON lyon_street_inventory USING gist(geometry);
-- Deliberate separate approval: matching a road does not populate this table.
CREATE TABLE lyon_verified_spaces (
 zone_id text PRIMARY KEY REFERENCES parking_zones(id), street_id text NOT NULL REFERENCES lyon_street_inventory(external_id),
 evidence_url text NOT NULL CHECK(evidence_url LIKE 'https://%'), verified_at timestamptz NOT NULL,
 fresh_until timestamptz NOT NULL CHECK(fresh_until>verified_at), regime text NOT NULL CHECK(regime IN ('UNO','UNSUPPORTED'))
);
CREATE TABLE parking_facilities (
 source_id text NOT NULL REFERENCES local_source_registry(id), external_id text NOT NULL,
 position geometry(Point,4326) NOT NULL, normalized jsonb NOT NULL,
 present boolean NOT NULL DEFAULT true, retrieved_at timestamptz NOT NULL, observation jsonb,
 PRIMARY KEY(source_id,external_id),
 CHECK(NOT ST_IsEmpty(position) AND ST_IsValid(position) AND ST_X(position) BETWEEN -180 AND 180 AND ST_Y(position) BETWEEN -90 AND 90)
);
CREATE INDEX parking_facilities_geography_gist ON parking_facilities USING gist((position::geography));
INSERT INTO schema_migrations(version) VALUES(4);
COMMIT;
