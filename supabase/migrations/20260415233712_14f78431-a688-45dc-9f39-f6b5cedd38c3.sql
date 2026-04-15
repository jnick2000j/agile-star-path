
ALTER TABLE public.tasks
ADD COLUMN completion_percentage integer NOT NULL DEFAULT 0;

ALTER TABLE public.entity_updates
ADD COLUMN is_risk_flagged boolean NOT NULL DEFAULT false;

ALTER TABLE public.entity_updates
ADD COLUMN risk_criticality text DEFAULT NULL;
