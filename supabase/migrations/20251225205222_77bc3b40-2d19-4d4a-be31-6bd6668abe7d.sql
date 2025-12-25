-- Create products table with product management best practices fields
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  programme_id UUID REFERENCES public.programmes(id),
  
  -- Product lifecycle stage (Stage-Gate methodology)
  stage TEXT NOT NULL DEFAULT 'discovery' CHECK (stage IN ('discovery', 'definition', 'development', 'launch', 'growth', 'maturity', 'decline', 'retired')),
  
  -- Product details
  product_type TEXT NOT NULL DEFAULT 'digital' CHECK (product_type IN ('digital', 'physical', 'service', 'platform', 'hybrid')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('concept', 'in_development', 'active', 'on_hold', 'deprecated', 'retired')),
  
  -- Product vision & strategy
  vision TEXT,
  value_proposition TEXT,
  target_market TEXT,
  
  -- Metrics & KPIs
  primary_metric TEXT,
  secondary_metrics TEXT[],
  
  -- Product ownership
  product_owner_id UUID,
  created_by UUID,
  
  -- Roadmap & planning
  launch_date DATE,
  next_review_date DATE,
  
  -- Financial
  revenue_target TEXT,
  cost_center TEXT,
  
  -- Prioritization (RICE scoring)
  reach_score INTEGER CHECK (reach_score >= 0 AND reach_score <= 10),
  impact_score INTEGER CHECK (impact_score >= 0 AND impact_score <= 10),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 10),
  effort_score INTEGER CHECK (effort_score >= 0 AND effort_score <= 10),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view products"
ON public.products FOR SELECT
USING (true);

CREATE POLICY "Users can create products"
ON public.products FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update products"
ON public.products FOR UPDATE
USING (auth.uid() = product_owner_id OR auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
USING (is_admin(auth.uid()));

-- Create product features table for feature management
CREATE TABLE public.product_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'discovery', 'designing', 'developing', 'testing', 'released', 'deprecated')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low', 'nice_to_have')),
  
  -- MoSCoW prioritization
  moscow TEXT CHECK (moscow IN ('must_have', 'should_have', 'could_have', 'wont_have')),
  
  -- RICE scores
  reach_score INTEGER,
  impact_score INTEGER,
  confidence_score INTEGER,
  effort_score INTEGER,
  
  -- Planning
  target_release TEXT,
  actual_release_date DATE,
  
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view features"
ON public.product_features FOR SELECT
USING (true);

CREATE POLICY "Users can create features"
ON public.product_features FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update features"
ON public.product_features FOR UPDATE
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete features"
ON public.product_features FOR DELETE
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_features_updated_at
BEFORE UPDATE ON public.product_features
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();