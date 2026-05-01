-- 1. Course chunk store -------------------------------------------------------
CREATE TABLE public.lms_course_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('course','module','lesson')),
  source_id uuid,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(768),
  token_estimate integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lms_course_chunks_org ON public.lms_course_chunks(organization_id);
CREATE INDEX idx_lms_course_chunks_course ON public.lms_course_chunks(course_id);
CREATE INDEX idx_lms_course_chunks_embedding
  ON public.lms_course_chunks USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists=100);

ALTER TABLE public.lms_course_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lms_course_chunks_select"
  ON public.lms_course_chunks FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'viewer'::text));

CREATE POLICY "lms_course_chunks_write"
  ON public.lms_course_chunks FOR ALL TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id, 'editor'::text))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id, 'editor'::text));

-- 2. Indexing status on courses ----------------------------------------------
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS kb_index_status text NOT NULL DEFAULT 'pending'
    CHECK (kb_index_status IN ('pending','indexed','disabled','error')),
  ADD COLUMN IF NOT EXISTS kb_indexed_at timestamptz;

CREATE OR REPLACE FUNCTION public.lms_courses_mark_pending()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.title IS DISTINCT FROM OLD.title)
     OR (NEW.description IS DISTINCT FROM OLD.description)
     OR (NEW.category IS DISTINCT FROM OLD.category)
     OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    NEW.kb_index_status := CASE WHEN NEW.status = 'published' THEN 'pending' ELSE 'disabled' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lms_courses_mark_pending_trg ON public.lms_courses;
CREATE TRIGGER lms_courses_mark_pending_trg
  BEFORE UPDATE ON public.lms_courses
  FOR EACH ROW EXECUTE FUNCTION public.lms_courses_mark_pending();

-- 3. Extend match_kb_chunks (include extensions in search_path for vector op) -
DROP FUNCTION IF EXISTS public.match_kb_chunks(uuid, extensions.vector, double precision, integer);

CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  _org_id uuid,
  _query_embedding extensions.vector,
  _match_threshold double precision DEFAULT 0.6,
  _match_count integer DEFAULT 8
)
RETURNS TABLE(
  source text,
  article_id uuid,
  chunk_id uuid,
  content text,
  similarity double precision,
  title text,
  summary text,
  category text,
  visibility text,
  status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  (
    SELECT
      'kb'::text AS source,
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
  )
  UNION ALL
  (
    SELECT
      'lms'::text AS source,
      lc.id AS article_id,
      cc.id AS chunk_id,
      cc.content,
      1 - (cc.embedding <=> _query_embedding) AS similarity,
      lc.title,
      lc.description AS summary,
      lc.category,
      'org'::text AS visibility,
      lc.status
    FROM lms_course_chunks cc
    JOIN lms_courses lc ON lc.id = cc.course_id
    WHERE cc.organization_id = _org_id
      AND lc.status = 'published'
      AND cc.embedding IS NOT NULL
      AND 1 - (cc.embedding <=> _query_embedding) > _match_threshold
  )
  ORDER BY similarity DESC
  LIMIT _match_count;
$function$;

REVOKE EXECUTE ON FUNCTION public.match_kb_chunks(uuid, extensions.vector, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_kb_chunks(uuid, extensions.vector, double precision, integer) TO authenticated, service_role;