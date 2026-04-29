
-- ===== KB CATEGORIES =====
CREATE TABLE public.kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KBC public read" ON public.kb_categories FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE POLICY "KBC org read" ON public.kb_categories FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "KBC insert" ON public.kb_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "KBC update" ON public.kb_categories FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));
CREATE POLICY "KBC delete" ON public.kb_categories FOR DELETE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER trg_kb_categories_updated_at BEFORE UPDATE ON public.kb_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== FEEDBACK =====
CREATE TABLE public.kb_article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  comment TEXT,
  user_id UUID REFERENCES auth.users(id),
  session_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kb_article_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KBF public submit" ON public.kb_article_feedback FOR INSERT TO anon, authenticated
  WITH CHECK (article_id IN (SELECT id FROM public.kb_articles WHERE visibility = 'public' AND status = 'published')
              OR public.has_org_access(auth.uid(), organization_id, 'viewer'));
CREATE POLICY "KBF org read" ON public.kb_article_feedback FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE OR REPLACE FUNCTION public.kb_feedback_update_counters()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_helpful THEN
    UPDATE public.kb_articles SET helpful_count = helpful_count + 1 WHERE id = NEW.article_id;
  ELSE
    UPDATE public.kb_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = NEW.article_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_kb_feedback_counters AFTER INSERT ON public.kb_article_feedback
  FOR EACH ROW EXECUTE FUNCTION public.kb_feedback_update_counters();

-- ===== TICKET DEFLECTIONS =====
CREATE TABLE public.kb_ticket_deflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.kb_articles(id) ON DELETE SET NULL,
  search_query TEXT,
  user_id UUID REFERENCES auth.users(id),
  resolved_without_ticket BOOLEAN NOT NULL DEFAULT false,
  ticket_id UUID REFERENCES public.helpdesk_tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kb_ticket_deflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KBD insert" ON public.kb_ticket_deflections FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "KBD org read" ON public.kb_ticket_deflections FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE OR REPLACE FUNCTION public.kb_increment_view(p_article_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.kb_articles SET view_count = view_count + 1 WHERE id = p_article_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.kb_increment_view(UUID) TO anon, authenticated;

CREATE INDEX idx_kb_categories_org ON public.kb_categories(organization_id, display_order);
CREATE INDEX idx_kb_feedback_article ON public.kb_article_feedback(article_id);
CREATE INDEX idx_kb_deflections_org ON public.kb_ticket_deflections(organization_id, created_at DESC);
