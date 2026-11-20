-- Migration: 0025_experience_tech_stacks
-- Junction table linking experiences to tech stacks. One tech stack can be
-- referenced by many experiences and vice versa; the pair is unique via the
-- composite PK so repeated POSTs are idempotent.
CREATE TABLE IF NOT EXISTS experience_tech_stacks (
    experience_id   INTEGER NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    tech_stack_id   INTEGER NOT NULL REFERENCES tech_stacks(id) ON DELETE CASCADE,
    PRIMARY KEY (experience_id, tech_stack_id)
);

-- Lookups hot path: timeline hydration scans by experience_id.
CREATE INDEX IF NOT EXISTS idx_experience_tech_stacks_experience
ON experience_tech_stacks(experience_id);

-- Reverse index for "which experiences reference this tech stack".
CREATE INDEX IF NOT EXISTS idx_experience_tech_stacks_tech_stack
ON experience_tech_stacks(tech_stack_id);
