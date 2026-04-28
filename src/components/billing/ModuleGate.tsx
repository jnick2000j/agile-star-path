import { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FeatureGate } from "@/components/billing/FeatureGate";

interface ModuleGateProps {
  feature: string;
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * Route-level gate for org-admin-toggleable modules (Programmes, Projects, Products).
 * If the feature is enabled, renders children directly. If disabled, renders an
 * AppLayout with the standard FeatureGate upgrade card (so users see the chrome).
 */
export function ModuleGate({ feature, title, description, children }: ModuleGateProps) {
  return (
    <FeatureGate
      feature={feature}
      fallback={
        <AppLayout title={title} subtitle="Module disabled">
          <FeatureGate feature={feature} title={title} description={description}>
            {null}
          </FeatureGate>
        </AppLayout>
      }
    >
      {children}
    </FeatureGate>
  );
}
