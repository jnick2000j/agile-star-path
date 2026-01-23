-- Create status_history table to track all status changes for projects, programmes, and products
CREATE TABLE public.status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'programme', 'product')),
  entity_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'deferred', 'reopened', 'closed', 'on_hold', 'status_change')),
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view status history for their organization entities"
ON public.status_history
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert status history"
ON public.status_history
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_status_history_entity ON public.status_history(entity_type, entity_id);
CREATE INDEX idx_status_history_changed_at ON public.status_history(changed_at DESC);