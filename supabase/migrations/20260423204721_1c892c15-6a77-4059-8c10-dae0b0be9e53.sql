-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================================================================
-- KB ARTICLES
-- =========================================================================
CREATE TABLE public.kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT,
  summary TEXT,
  body TEXT NOT NULL DEFAULT '',
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','public')),
  source TEXT NOT NULL DEFAULT 'authored' CHECK (source IN ('authored','uploaded','imported')),
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  embedding_status TEXT NOT NULL DEFAULT 'pending' CHECK (embedding_status IN ('pending','indexed','failed')),
  embedding_updated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  author_user_id UUID,
  last_edited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kb_articles_org ON public.kb_articles(organization_id);
CREATE INDEX idx_kb_articles_status ON public.kb_articles(status) WHERE status = 'published';
CREATE INDEX idx_kb_articles_fts ON public.kb_articles USING GIN (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(body,''))
);

ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their KB articles"
  ON public.kb_articles FOR SELECT
  USING (
    public.has_org_access(auth.uid(), organization_id, 'viewer')
    OR (
      visibility = 'public'
      AND status = 'published'
      AND public.has_stakeholder_access(auth.uid(), 'organization', organization_id)
    )
  );

CREATE POLICY "Editors can create KB articles"
  ON public.kb_articles FOR INSERT
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Editors can update KB articles"
  ON public.kb_articles FOR UPDATE
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'));

CREATE POLICY "Admins can delete KB articles"
  ON public.kb_articles FOR DELETE
  USING (public.has_org_access(auth.uid(), organization_id, 'admin'));

CREATE TRIGGER trg_kb_articles_updated_at
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- KB ARTICLE CHUNKS (embeddings)
-- =========================================================================
CREATE TABLE public.kb_article_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  token_estimate INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kb_chunks_article ON public.kb_article_chunks(article_id);
CREATE INDEX idx_kb_chunks_org ON public.kb_article_chunks(organization_id);
CREATE INDEX idx_kb_chunks_embedding ON public.kb_article_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.kb_article_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chunks in their org"
  ON public.kb_article_chunks FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Editors can write chunks in their org"
  ON public.kb_article_chunks FOR ALL
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

-- =========================================================================
-- KB ATTACHMENTS
-- =========================================================================
CREATE TABLE public.kb_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  parsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kb_attachments_article ON public.kb_attachments(article_id);
CREATE INDEX idx_kb_attachments_org ON public.kb_attachments(organization_id);

ALTER TABLE public.kb_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view attachments in their org"
  ON public.kb_attachments FOR SELECT
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'));

CREATE POLICY "Editors can manage attachments in their org"
  ON public.kb_attachments FOR ALL
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'));

-- =========================================================================
-- KB SEARCH LOG
-- =========================================================================
CREATE TABLE public.kb_search_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  query TEXT NOT NULL,
  surface TEXT NOT NULL DEFAULT 'portal' CHECK (surface IN ('portal','agent','ticket_create','standalone')),
  matched_article_ids UUID[] NOT NULL DEFAULT '{}',
  ai_answer TEXT,
  was_helpful BOOLEAN,
  created_ticket BOOLEAN NOT NULL DEFAULT false,
  ticket_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kb_search_org ON public.kb_search_log(organization_id);
CREATE INDEX idx_kb_search_user ON public.kb_search_log(user_id);

ALTER TABLE public.kb_search_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own searches"
  ON public.kb_search_log FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_org_access(auth.uid(), organization_id, 'admin')
  );

CREATE POLICY "Anyone authenticated can log searches in their org"
  ON public.kb_search_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.has_org_access(auth.uid(), organization_id, 'viewer')
      OR public.has_stakeholder_access(auth.uid(), 'organization', organization_id)
    )
  );

CREATE POLICY "Users can update their own search rows"
  ON public.kb_search_log FOR UPDATE
  USING (auth.uid() = user_id);

-- =========================================================================
-- VECTOR SEARCH FUNCTION
-- =========================================================================
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  _org_id UUID,
  _query_embedding vector(768),
  _match_threshold FLOAT DEFAULT 0.6,
  _match_count INT DEFAULT 8
)
RETURNS TABLE (
  article_id UUID,
  chunk_id UUID,
  content TEXT,
  similarity FLOAT,
  title TEXT,
  summary TEXT,
  category TEXT,
  visibility TEXT,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.article_id,
    c.id AS chunk_id,
    c.content,
    1 - (c.embedding <=> _query_embedding) AS similarity,
    a.title,
    a.summary,
    a.category,
    a.visibility,
    a.status
  FROM kb_article_chunks c
  JOIN kb_articles a ON a.id = c.article_id
  WHERE c.organization_id = _org_id
    AND a.status = 'published'
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> _query_embedding) > _match_threshold
  ORDER BY c.embedding <=> _query_embedding
  LIMIT _match_count;
$$;

-- =========================================================================
-- STORAGE BUCKET
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-attachments', 'kb-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members can read kb attachments in their org"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kb-attachments'
    AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'viewer')
  );

CREATE POLICY "Editors can upload kb attachments in their org"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kb-attachments'
    AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'editor')
  );

CREATE POLICY "Editors can update kb attachments in their org"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'kb-attachments'
    AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'editor')
  );

CREATE POLICY "Editors can delete kb attachments in their org"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'kb-attachments'
    AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid, 'editor')
  );