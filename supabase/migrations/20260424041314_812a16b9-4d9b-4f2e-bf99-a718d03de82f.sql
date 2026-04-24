CREATE TABLE public.csat_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  intro_text text NOT NULL DEFAULT 'How was your support experience?',
  rating_scale integer NOT NULL DEFAULT 5 CHECK (rating_scale IN (3, 5)),
  rating_label text NOT NULL DEFAULT 'How satisfied were you with the support you received?',
  comment_label text NOT NULL DEFAULT 'Tell us more about your experience (optional)',
  follow_up_label text,
  thank_you_message text NOT NULL DEFAULT 'Thank you for your feedback!',
  send_delay_hours integer NOT NULL DEFAULT 0 CHECK (send_delay_hours >= 0 AND send_delay_hours <= 168),
  ticket_types text[] NOT NULL DEFAULT ARRAY['support','incident','service_request','question','problem']::text[],
  min_priority text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE public.csat_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  reporter_email text,
  token text NOT NULL UNIQUE,
  rating integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  comment text,
  follow_up_answer text,
  sent_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT csat_responses_ticket_unique UNIQUE (ticket_id)
);

CREATE INDEX idx_csat_responses_org ON public.csat_responses(organization_id);
CREATE INDEX idx_csat_responses_ticket ON public.csat_responses(ticket_id);
CREATE INDEX idx_csat_responses_token ON public.csat_responses(token);

ALTER TABLE public.csat_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org csat survey"
ON public.csat_surveys FOR SELECT
USING (public.has_org_access(auth.uid(), organization_id, 'viewer') OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage org csat survey insert"
ON public.csat_surveys FOR INSERT
WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage org csat survey update"
ON public.csat_surveys FOR UPDATE
USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage org csat survey delete"
ON public.csat_surveys FOR DELETE
USING (public.has_org_access(auth.uid(), organization_id, 'admin') OR public.is_admin(auth.uid()));

CREATE POLICY "Members view org csat responses"
ON public.csat_responses FOR SELECT
USING (
  public.has_org_access(auth.uid(), organization_id, 'viewer')
  OR public.is_admin(auth.uid())
);

-- Allow public read by token (anonymous reporters opening the survey link)
CREATE POLICY "Public can read csat by token"
ON public.csat_responses FOR SELECT
TO anon, authenticated
USING (true);

-- Allow public submission while not yet responded and not expired
CREATE POLICY "Public can submit csat by token"
ON public.csat_responses FOR UPDATE
TO anon, authenticated
USING (responded_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
WITH CHECK (true);

CREATE TRIGGER update_csat_surveys_updated_at
BEFORE UPDATE ON public.csat_surveys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();