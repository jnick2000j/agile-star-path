import { StandalonePricingPage } from "@/components/pricing/StandalonePricingPage";

export default function HelpdeskPricing() {
  return (
    <StandalonePricingPage
      kind="helpdesk"
      brandName="TaskMaster Helpdesk"
      heroBadge="Free tier • 14-day trial on paid plans"
      heroTitle="Helpdesk pricing for teams of every size"
      heroDescription="Start free with 1 agent and 100 tickets/month. Upgrade as your team grows — never pay for unused seats."
    />
  );
}
