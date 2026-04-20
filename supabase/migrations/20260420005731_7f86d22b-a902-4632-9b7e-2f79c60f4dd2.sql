-- Conversations
CREATE TABLE IF NOT EXISTS public.ai_advisor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advisor_convo_user ON public.ai_advisor_conversations(user_id, updated_at DESC);
ALTER TABLE public.ai_advisor_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own advisor conversations"
  ON public.ai_advisor_conversations FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER ai_advisor_conversations_updated_at BEFORE UPDATE ON public.ai_advisor_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages
CREATE TABLE IF NOT EXISTS public.ai_advisor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_advisor_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advisor_msg_conv ON public.ai_advisor_messages(conversation_id, created_at);
ALTER TABLE public.ai_advisor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own advisor messages"
  ON public.ai_advisor_messages FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Agent actions
CREATE TABLE IF NOT EXISTS public.ai_agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_advisor_conversations(id) ON DELETE SET NULL,
  audit_id UUID REFERENCES public.ai_audit_log(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  tool_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  tool_output JSONB,
  target_entity_type TEXT,
  target_entity_id UUID,
  is_write BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'completed',
  reverted_at TIMESTAMPTZ,
  reverted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_actions_org ON public.ai_agent_actions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_user ON public.ai_agent_actions(user_id, created_at DESC);
ALTER TABLE public.ai_agent_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org viewers can read agent actions"
  ON public.ai_agent_actions FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'viewer'))
  );
CREATE POLICY "Users insert their own agent actions"
  ON public.ai_agent_actions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Editors update agent actions"
  ON public.ai_agent_actions FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR (organization_id IS NOT NULL AND public.has_org_access(auth.uid(), organization_id, 'editor'))
  );

-- Insights
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  scope_type TEXT,
  scope_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  evidence JSONB DEFAULT '{}'::jsonb,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_by UUID,
  dismissed_at TIMESTAMPTZ,
  resolved BOOLEAN NOT NULL DEFAULT false,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  generated_by TEXT NOT NULL DEFAULT 'scan',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insights_org ON public.ai_insights(organization_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_open ON public.ai_insights(organization_id, dismissed, resolved);
CREATE UNIQUE INDEX IF NOT EXISTS idx_insights_dedupe
  ON public.ai_insights(organization_id, insight_type, scope_type, scope_id)
  WHERE dismissed = false AND resolved = false;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org viewers see insights"
  ON public.ai_insights FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR public.has_org_access(auth.uid(), organization_id, 'viewer')
  );
CREATE POLICY "Org editors update insights"
  ON public.ai_insights FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR public.has_org_access(auth.uid(), organization_id, 'editor')
  );
CREATE POLICY "Service can insert insights"
  ON public.ai_insights FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Admins delete insights"
  ON public.ai_insights FOR DELETE
  USING (public.is_admin(auth.uid()));