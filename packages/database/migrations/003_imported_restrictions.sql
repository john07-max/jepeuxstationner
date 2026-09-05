BEGIN;
-- Additive side table: existing curb-based rules and coverage remain unchanged.
CREATE TABLE imported_parking_rules (
 source_id text NOT NULL REFERENCES data_sources(id),
 external_id text NOT NULL,
 geometry geometry(Geometry,4326) NOT NULL,
 valid_during tstzrange NOT NULL,
 active boolean NOT NULL,
 present boolean NOT NULL DEFAULT true,
 supported boolean NOT NULL,
 retrieved_at timestamptz NOT NULL,
 normalized jsonb NOT NULL,
 PRIMARY KEY(source_id,external_id),
 CHECK (ST_IsValid(geometry) AND NOT ST_IsEmpty(geometry)),
 CHECK (GeometryType(geometry) IN ('POINT','LINESTRING','POLYGON','MULTIPOLYGON')),
 CHECK (ST_XMin(Box3D(geometry)) >= -180 AND ST_XMax(Box3D(geometry)) <= 180 AND ST_YMin(Box3D(geometry)) >= -90 AND ST_YMax(Box3D(geometry)) <= 90),
 CHECK (NOT isempty(valid_during) AND NOT lower_inf(valid_during) AND lower_inc(valid_during) AND NOT upper_inc(valid_during)),
 CHECK (normalized->>'effect'='FORBIDDEN' AND normalized->'source'->>'legalAuthority'='informative')
);
CREATE INDEX imported_rules_geometry_gist ON imported_parking_rules USING gist(geometry);
CREATE INDEX imported_rules_geography_gist ON imported_parking_rules USING gist((geometry::geography));
CREATE INDEX imported_rules_period_gist ON imported_parking_rules USING gist(valid_during);
INSERT INTO schema_migrations(version) VALUES (3);
COMMIT;
