BEGIN;
SELECT pg_advisory_xact_lock(140014,1);
CREATE TABLE IF NOT EXISTS player_loadout(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot TEXT NOT NULL,cosmetic_id TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,slot));
CREATE TABLE IF NOT EXISTS progression_cutovers(policy TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS player_unlock_grants(
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 unlock_id TEXT NOT NULL CHECK(unlock_id IN ('word-network','wordsmith')),
 receipt JSONB NOT NULL,
 PRIMARY KEY(user_id,unlock_id)
);
WITH cutover AS (
 INSERT INTO progression_cutovers(policy,applied_at) VALUES('vocabulary-unlocks.v1',clock_timestamp())
 ON CONFLICT DO NOTHING RETURNING applied_at
), old_players AS (
 SELECT u.id,u.xp,
 EXISTS(SELECT 1 FROM user_skills s WHERE s.user_id=u.id AND lower(s.skill)='vocabulary' AND s.confidence>=0.55) AS words,
 EXISTS(SELECT 1 FROM user_skills s WHERE s.user_id=u.id AND lower(s.skill)='vocabulary' AND s.confidence>=0.70) AS smith,
 EXISTS(SELECT 1 FROM player_loadout l WHERE l.user_id=u.id AND l.cosmetic_id='wordsmith-pin') AS pin
 FROM users u
), candidates AS (
 SELECT id,'word-network' AS unlock_id FROM old_players WHERE words OR xp>=300 OR pin
 UNION ALL SELECT id,'wordsmith' AS unlock_id FROM old_players WHERE smith OR pin
)
INSERT INTO player_unlock_grants(user_id,unlock_id,receipt)
 SELECT c.id,c.unlock_id,jsonb_build_object('unlockId',c.unlock_id,'method','vocabulary-unlocks.v1','source','legacy-personal','recordedAt',cutover.applied_at)
 FROM candidates c CROSS JOIN cutover ON CONFLICT DO NOTHING;
COMMIT;
