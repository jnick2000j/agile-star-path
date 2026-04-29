ALTER TABLE public.helpdesk_catalog_items
  ADD COLUMN IF NOT EXISTS parent_item_id UUID
    REFERENCES public.helpdesk_catalog_items(id) ON DELETE SET NULL;

ALTER TABLE public.helpdesk_catalog_items
  DROP CONSTRAINT IF EXISTS helpdesk_catalog_items_no_self_parent;
ALTER TABLE public.helpdesk_catalog_items
  ADD CONSTRAINT helpdesk_catalog_items_no_self_parent
  CHECK (parent_item_id IS NULL OR parent_item_id <> id);

CREATE INDEX IF NOT EXISTS idx_helpdesk_catalog_items_parent
  ON public.helpdesk_catalog_items(parent_item_id);