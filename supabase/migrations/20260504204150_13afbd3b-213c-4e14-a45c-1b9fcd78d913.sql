
ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS converted_to_feature_id uuid REFERENCES public.product_features(id) ON DELETE SET NULL;

ALTER TABLE public.product_features
  ADD COLUMN IF NOT EXISTS source_ticket_id uuid REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.helpdesk_ticket_feature_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.product_features(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  converted_by uuid NOT NULL,
  reason text NOT NULL,
  feature_priority text,
  attachments_copied integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.helpdesk_ticket_feature_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_feature_conv_select"
ON public.helpdesk_ticket_feature_conversions
FOR SELECT
TO authenticated
USING (has_org_access(auth.uid(), organization_id, 'viewer'::text));

CREATE POLICY "ticket_feature_conv_insert"
ON public.helpdesk_ticket_feature_conversions
FOR INSERT
TO authenticated
WITH CHECK (has_org_access(auth.uid(), organization_id, 'editor'::text) AND converted_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_hd_ft_conv_ticket ON public.helpdesk_ticket_feature_conversions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_hd_ft_conv_feature ON public.helpdesk_ticket_feature_conversions(feature_id);
CREATE INDEX IF NOT EXISTS idx_hd_ft_conv_org ON public.helpdesk_ticket_feature_conversions(organization_id);
