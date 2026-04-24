import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { PermissionsProvider } from "@/hooks/usePermissions";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Programmes from "./pages/Programmes";
import ProgrammeDetails from "./pages/ProgrammeDetails";
import ProgrammeBlueprint from "./pages/ProgrammeBlueprint";
import ProgrammeTranches from "./pages/ProgrammeTranches";
import ProgrammeDefinition from "./pages/ProgrammeDefinition";
import SuccessPlan from "./pages/SuccessPlan";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import ProjectBriefs from "./pages/ProjectBriefs";
import WorkPackages from "./pages/WorkPackages";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import ProductRoadmap from "./pages/ProductRoadmap";
import FeatureBacklog from "./pages/FeatureBacklog";
import SprintPlanning from "./pages/SprintPlanning";
import FeatureDependencies from "./pages/FeatureDependencies";
import UnifiedBacklog from "./pages/UnifiedBacklog";
import RiskRegister from "./pages/RiskRegister";
import IssueRegister from "./pages/IssueRegister";
import BenefitsRegister from "./pages/BenefitsRegister";
import StakeholderRegister from "./pages/StakeholderRegister";
import BusinessRequirements from "./pages/BusinessRequirements";
import TechnicalRequirements from "./pages/TechnicalRequirements";
import LessonsLearned from "./pages/LessonsLearned";
import Documentation from "./pages/Documentation";
import Wizards from "./pages/Wizards";
import Updates from "./pages/Updates";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";
import BrandingSettings from "./pages/BrandingSettings";
import TaskManagement from "./pages/TaskManagement";
import Tasks from "./pages/Tasks";
import Timesheets from "./pages/Timesheets";
import MilestoneTracking from "./pages/MilestoneTracking";
import StageGates from "./pages/StageGates";
import ChangeControl from "./pages/ChangeControl";
import ExceptionManagement from "./pages/ExceptionManagement";
import QualityManagement from "./pages/QualityManagement";
import PRINCE2Dashboard from "./pages/PRINCE2Dashboard";
import Registers from "./pages/Registers";
import PlatformAdmin from "./pages/PlatformAdmin";
import Onboarding from "./pages/Onboarding";
import Billing from "./pages/Billing";
import SecurityCenter from "./pages/SecurityCenter";
import Pricing from "./pages/Pricing";
import HelpdeskPricing from "./pages/HelpdeskPricing";
import ITSMPricing from "./pages/ITSMPricing";
import AddonsCatalog from "./pages/AddonsCatalog";
import AcceptInvite from "./pages/AcceptInvite";
import CheckoutReturn from "./pages/CheckoutReturn";
import Support from "./pages/Support";
import Helpdesk from "./pages/Helpdesk";
import HelpdeskTicketDetail from "./pages/HelpdeskTicketDetail";
import SupportPortal from "./pages/SupportPortal";
import MyTickets from "./pages/MyTickets";
import ChangeManagement from "./pages/ChangeManagement";
import ChangeManagementDetail from "./pages/ChangeManagementDetail";
import ChangeControlPortal from "./pages/ChangeControlPortal";
import MyChanges from "./pages/MyChanges";
import ChangeManagementSettings from "./pages/ChangeManagementSettings";
import Governance from "./pages/Governance";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import StakeholderPortal from "./pages/StakeholderPortal";
import AIApprovals from "./pages/AIApprovals";
import AIWizards from "./pages/AIWizards";
import AIAdvisor from "./pages/AIAdvisor";
import AIInsights from "./pages/AIInsights";
import Knowledgebase from "./pages/Knowledgebase";
import KnowledgebaseArticle from "./pages/KnowledgebaseArticle";
import NotFound from "./pages/NotFound";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
          <PermissionsProvider>
          <PaymentTestModeBanner />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/helpdesk-pricing" element={<HelpdeskPricing />} />
            <Route path="/itsm-pricing" element={<ITSMPricing />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/checkout/return" element={<CheckoutReturn />} />
            <Route path="/csat/:token" element={<CSATResponse />} />
            <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
            <Route path="/billing/addons" element={<ProtectedRoute><AddonsCatalog /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/programmes" element={<ProtectedRoute><Programmes /></ProtectedRoute>} />
            <Route path="/programmes/details" element={<ProtectedRoute><ProgrammeDetails /></ProtectedRoute>} />
            <Route path="/programmes/blueprint" element={<ProtectedRoute><ProgrammeBlueprint /></ProtectedRoute>} />
            <Route path="/programmes/tranches" element={<ProtectedRoute><ProgrammeTranches /></ProtectedRoute>} />
            <Route path="/programmes/definition" element={<ProtectedRoute><ProgrammeDefinition /></ProtectedRoute>} />
            <Route path="/programmes/success-plan" element={<ProtectedRoute><SuccessPlan /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/projects/details" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
            <Route path="/projects/briefs" element={<ProtectedRoute><ProjectBriefs /></ProtectedRoute>} />
            <Route path="/projects/work-packages" element={<ProtectedRoute><WorkPackages /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/products/details" element={<ProtectedRoute><ProductDetails /></ProtectedRoute>} />
            <Route path="/products/roadmap" element={<ProtectedRoute><ProductRoadmap /></ProtectedRoute>} />
            <Route path="/products/features" element={<ProtectedRoute><FeatureBacklog /></ProtectedRoute>} />
            <Route path="/products/dependencies" element={<ProtectedRoute><FeatureDependencies /></ProtectedRoute>} />
            <Route path="/planning/backlog" element={<ProtectedRoute><UnifiedBacklog /></ProtectedRoute>} />
            <Route path="/planning/sprints" element={<ProtectedRoute><SprintPlanning /></ProtectedRoute>} />
            <Route path="/registers" element={<ProtectedRoute><Registers /></ProtectedRoute>} />
            <Route path="/registers/risks" element={<ProtectedRoute><RiskRegister /></ProtectedRoute>} />
            <Route path="/registers/issues" element={<ProtectedRoute><IssueRegister /></ProtectedRoute>} />
            <Route path="/registers/benefits" element={<ProtectedRoute><BenefitsRegister /></ProtectedRoute>} />
            <Route path="/registers/stakeholders" element={<ProtectedRoute><StakeholderRegister /></ProtectedRoute>} />
            <Route path="/registers/business-requirements" element={<ProtectedRoute><BusinessRequirements /></ProtectedRoute>} />
            <Route path="/registers/technical-requirements" element={<ProtectedRoute><TechnicalRequirements /></ProtectedRoute>} />
            <Route path="/registers/lessons" element={<ProtectedRoute><LessonsLearned /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/updates" element={<ProtectedRoute><Updates /></ProtectedRoute>} />
            <Route path="/documentation" element={<ProtectedRoute><Documentation /></ProtectedRoute>} />
            <Route path="/wizards" element={<ProtectedRoute><Wizards /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/branding" element={<ProtectedRoute><BrandingSettings /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute><SecurityCenter /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requiredRoles={["admin"]}><AdminPanel /></ProtectedRoute>} />
            <Route path="/platform-admin" element={<ProtectedRoute requiredRoles={["admin"]}><PlatformAdmin /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/prince2" element={<ProtectedRoute><PRINCE2Dashboard /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/timesheets" element={<ProtectedRoute><Timesheets /></ProtectedRoute>} />
            <Route path="/prince2/tasks" element={<ProtectedRoute><TaskManagement /></ProtectedRoute>} />
            <Route path="/prince2/milestones" element={<ProtectedRoute><MilestoneTracking /></ProtectedRoute>} />
            <Route path="/prince2/stage-gates" element={<ProtectedRoute><StageGates /></ProtectedRoute>} />
            <Route path="/prince2/change-control" element={<ProtectedRoute><ChangeControl /></ProtectedRoute>} />
            <Route path="/prince2/exceptions" element={<ProtectedRoute><ExceptionManagement /></ProtectedRoute>} />
            <Route path="/prince2/quality" element={<ProtectedRoute><QualityManagement /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><Helpdesk /></ProtectedRoute>} />
            <Route path="/support/legacy" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="/support/portal" element={<ProtectedRoute><SupportPortal /></ProtectedRoute>} />
            <Route path="/support/my-tickets" element={<ProtectedRoute><MyTickets /></ProtectedRoute>} />
            <Route path="/support/tickets/:id" element={<ProtectedRoute><HelpdeskTicketDetail /></ProtectedRoute>} />
            <Route path="/change-management" element={<ProtectedRoute><ChangeManagement /></ProtectedRoute>} />
            <Route path="/change-management/portal" element={<ProtectedRoute><ChangeControlPortal /></ProtectedRoute>} />
            <Route path="/change-management/my-changes" element={<ProtectedRoute><MyChanges /></ProtectedRoute>} />
            <Route path="/change-management/settings" element={<ProtectedRoute><ChangeManagementSettings /></ProtectedRoute>} />
            <Route path="/change-management/:id" element={<ProtectedRoute><ChangeManagementDetail /></ProtectedRoute>} />
            <Route path="/governance" element={<ProtectedRoute><Governance /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/portal" element={<ProtectedRoute><StakeholderPortal /></ProtectedRoute>} />
            <Route path="/ai-approvals" element={<ProtectedRoute><AIApprovals /></ProtectedRoute>} />
            <Route path="/ai-wizards" element={<ProtectedRoute><AIWizards /></ProtectedRoute>} />
            <Route path="/ai-advisor" element={<ProtectedRoute><AIAdvisor /></ProtectedRoute>} />
            <Route path="/ai-insights" element={<ProtectedRoute><AIInsights /></ProtectedRoute>} />
            <Route path="/knowledgebase" element={<ProtectedRoute><Knowledgebase /></ProtectedRoute>} />
            <Route path="/knowledgebase/:id" element={<ProtectedRoute><KnowledgebaseArticle /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </PermissionsProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
