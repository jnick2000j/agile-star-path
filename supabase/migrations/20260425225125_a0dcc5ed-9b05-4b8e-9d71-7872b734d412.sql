
-- Allow Construction as a first-class methodology
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_methodology_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_methodology_check
  CHECK (methodology = ANY (ARRAY['PRINCE2'::text, 'Agile'::text, 'Hybrid'::text, 'Waterfall'::text, 'Construction'::text]));

-- Project kind: where the project sits in the construction lifecycle (or 'standard' for non-construction)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_kind text NOT NULL DEFAULT 'standard';
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_project_kind_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_project_kind_check
  CHECK (project_kind = ANY (ARRAY[
    'standard',
    'pursuit',           -- pre-award pursuit / capture project
    'bid',               -- live bid being assembled
    'preconstruction',   -- post-award, mobilising
    'construction',      -- delivery on site
    'closeout'           -- handover / DLP / final account
  ]));

-- Optional links from a delivery project back to its source pursuit / RFP / bid / award record
-- These reference vertical_entity_records since RFPs / Bids / Awards live there.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS source_opportunity_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS source_rfp_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS source_bid_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS source_award_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS contract_value numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS contract_currency text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS contract_form text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_name text;

-- Soft FK (SET NULL) to vertical_entity_records so deleting a record doesn't kill a project
DO $$ BEGIN
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_source_opportunity_fk FOREIGN KEY (source_opportunity_id)
    REFERENCES public.vertical_entity_records(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_source_rfp_fk FOREIGN KEY (source_rfp_id)
    REFERENCES public.vertical_entity_records(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_source_bid_fk FOREIGN KEY (source_bid_id)
    REFERENCES public.vertical_entity_records(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_source_award_fk FOREIGN KEY (source_award_id)
    REFERENCES public.vertical_entity_records(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_projects_project_kind ON public.projects(project_kind);
CREATE INDEX IF NOT EXISTS idx_projects_source_bid ON public.projects(source_bid_id) WHERE source_bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_source_rfp ON public.projects(source_rfp_id) WHERE source_rfp_id IS NOT NULL;

-- Programme kind: lets Capital Programme / Bid Pipeline programmes be flagged distinctly
ALTER TABLE public.programmes ADD COLUMN IF NOT EXISTS programme_kind text NOT NULL DEFAULT 'standard';
ALTER TABLE public.programmes DROP CONSTRAINT IF EXISTS programmes_programme_kind_check;
ALTER TABLE public.programmes ADD CONSTRAINT programmes_programme_kind_check
  CHECK (programme_kind = ANY (ARRAY['standard','capital','pursuit_pipeline','framework']));

-- Make sure Construction & Engineering vertical exposes the new modules in its enabled_modules list
UPDATE public.industry_verticals
SET enabled_modules = ARRAY(
  SELECT DISTINCT unnest(enabled_modules || ARRAY[
    'opportunities','rfps','bids','award-contracts','pursuit_pipeline',
    'project-lifecycle-phases','preconstruction-checklist','win-loss-reviews',
    'qualifications-prequals','bid-no-go-decisions'
  ])
)
WHERE id = 'construction';
