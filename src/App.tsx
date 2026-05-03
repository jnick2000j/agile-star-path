import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { PermissionsProvider } from "@/hooks/usePermissions";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ModuleGate } from "@/components/billing/ModuleGate";

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
import Migrations from "./pages/Migrations";
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
import HelpdeskWorkflows from "./pages/HelpdeskWorkflows";
import CMDB from "./pages/CMDB";
import CMDBDetail from "./pages/CMDBDetail";
import ServiceCatalog from "./pages/ServiceCatalog";
import ServiceCatalogAdmin from "./pages/ServiceCatalogAdmin";
import Problems from "./pages/Problems";
import ProblemDetail from "./pages/ProblemDetail";
import MajorIncidents from "./pages/MajorIncidents";
import MajorIncidentDetail from "./pages/MajorIncidentDetail";
import StatusPageAdmin from "./pages/StatusPageAdmin";
import StatusPagePublic from "./pages/StatusPagePublic";
import CMWorkflows from "./pages/CMWorkflows";

import MyTickets from "./pages/MyTickets";
import HelpArticle from "./pages/HelpArticle";
import SLAManagement from "./pages/SLAManagement";
import AssetManagement from "./pages/AssetManagement";
import HelpdeskAnalytics from "./pages/HelpdeskAnalytics";
import CSATDashboard from "./pages/CSATDashboard";
import CSATSurvey from "./pages/CSATSurvey";
import TicketIntake from "./pages/TicketIntake";
import EmailIntake from "./pages/EmailIntake";
import MacrosPage from "./pages/MacrosPage";
import SLAEscalationRules from "./pages/SLAEscalationRules";
import ApprovalChainsPage from "./pages/ApprovalChainsPage";
import HelpdeskReportsPage from "./pages/HelpdeskReportsPage";
import { CustomerPortalLayout } from "./components/portal/CustomerPortalLayout";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalTicketList from "./pages/portal/PortalTicketList";
import PortalTicketDetail from "./pages/portal/PortalTicketDetail";
import PortalNewTicket from "./pages/portal/PortalNewTicket";
import PortalKB from "./pages/portal/PortalKB";
import PortalKBArticle from "./pages/portal/PortalKBArticle";
import PortalCatalog from "./pages/portal/PortalCatalog";
import PortalTraining from "./pages/portal/PortalTraining";
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
import Automations from "./pages/Automations";
import RFIs from "./pages/RFIs";
import Submittals from "./pages/Submittals";
import DailyLogs from "./pages/DailyLogs";
import PunchList from "./pages/PunchList";
import Engagements from "./pages/Engagements";
import Retainers from "./pages/Retainers";
import VerticalEntityRegister from "./pages/VerticalEntityRegister";
import VerticalsDocs from "./pages/VerticalsDocs";
import KnowledgebaseArticle from "./pages/KnowledgebaseArticle";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import LmsCatalog from "./pages/lms/LmsCatalog";
import MyLearning from "./pages/lms/MyLearning";
import CourseDetail from "./pages/lms/CourseDetail";
import LmsAdmin from "./pages/lms/LmsAdmin";
import LmsCourseEditor from "./pages/lms/LmsCourseEditor";
import LmsQuizEditor from "./pages/lms/LmsQuizEditor";
import LmsManagerDashboard from "./pages/lms/LmsManagerDashboard";

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
            <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
            <Route path="/billing/addons" element={<ProtectedRoute><AddonsCatalog /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/programmes" element={<ProtectedRoute><ModuleGate feature="feature_module_programmes" title="Programmes" description="The Programmes module is disabled for this organization. An admin can re-enable it from Settings → General → Modules."><Programmes /></ModuleGate></ProtectedRoute>} />
            <Route path="/programmes/details" element={<ProtectedRoute><ModuleGate feature="feature_module_programmes" title="Programmes" description="The Programmes module is disabled for this organization."><ProgrammeDetails /></ModuleGate></ProtectedRoute>} />
            <Route path="/programmes/blueprint" element={<ProtectedRoute><ModuleGate feature="feature_module_programmes" title="Programmes" description="The Programmes module is disabled for this organization."><ProgrammeBlueprint /></ModuleGate></ProtectedRoute>} />
            <Route path="/programmes/tranches" element={<ProtectedRoute><ModuleGate feature="feature_module_programmes" title="Programmes" description="The Programmes module is disabled for this organization."><ProgrammeTranches /></ModuleGate></ProtectedRoute>} />
            <Route path="/programmes/definition" element={<ProtectedRoute><ModuleGate feature="feature_module_programmes" title="Programmes" description="The Programmes module is disabled for this organization."><ProgrammeDefinition /></ModuleGate></ProtectedRoute>} />
            <Route path="/programmes/success-plan" element={<ProtectedRoute><ModuleGate feature="feature_module_programmes" title="Programmes" description="The Programmes module is disabled for this organization."><SuccessPlan /></ModuleGate></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ModuleGate feature="feature_module_projects" title="Projects" description="The Projects module is disabled for this organization. An admin can re-enable it from Settings → General → Modules."><Projects /></ModuleGate></ProtectedRoute>} />
            <Route path="/projects/details" element={<ProtectedRoute><ModuleGate feature="feature_module_projects" title="Projects" description="The Projects module is disabled for this organization."><ProjectDetails /></ModuleGate></ProtectedRoute>} />
            <Route path="/projects/briefs" element={<ProtectedRoute><ModuleGate feature="feature_module_projects" title="Projects" description="The Projects module is disabled for this organization."><ProjectBriefs /></ModuleGate></ProtectedRoute>} />
            <Route path="/projects/work-packages" element={<ProtectedRoute><ModuleGate feature="feature_module_projects" title="Projects" description="The Projects module is disabled for this organization."><WorkPackages /></ModuleGate></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><ModuleGate feature="feature_module_products" title="Products" description="The Products module is disabled for this organization. An admin can re-enable it from Settings → General → Modules."><Products /></ModuleGate></ProtectedRoute>} />
            <Route path="/products/details" element={<ProtectedRoute><ModuleGate feature="feature_module_products" title="Products" description="The Products module is disabled for this organization."><ProductDetails /></ModuleGate></ProtectedRoute>} />
            <Route path="/products/roadmap" element={<ProtectedRoute><ModuleGate feature="feature_module_products" title="Products" description="The Products module is disabled for this organization."><ProductRoadmap /></ModuleGate></ProtectedRoute>} />
            <Route path="/products/features" element={<ProtectedRoute><ModuleGate feature="feature_module_products" title="Products" description="The Products module is disabled for this organization."><FeatureBacklog /></ModuleGate></ProtectedRoute>} />
            <Route path="/products/dependencies" element={<ProtectedRoute><ModuleGate feature="feature_module_products" title="Products" description="The Products module is disabled for this organization."><FeatureDependencies /></ModuleGate></ProtectedRoute>} />
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
            <Route path="/admin/migrations" element={<ProtectedRoute requiredRoles={["admin"]}><Migrations /></ProtectedRoute>} />
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
            <Route path="/support/portal" element={<Navigate to="/portal" replace />} />
            <Route path="/support/my-tickets" element={<ProtectedRoute><MyTickets /></ProtectedRoute>} />
            <Route path="/support/tickets/:id" element={<ProtectedRoute><HelpdeskTicketDetail /></ProtectedRoute>} />
            <Route path="/support/workflows" element={<ProtectedRoute><HelpdeskWorkflows /></ProtectedRoute>} />
            <Route path="/cmdb" element={<ProtectedRoute><CMDB /></ProtectedRoute>} />
            <Route path="/cmdb/:id" element={<ProtectedRoute><CMDBDetail /></ProtectedRoute>} />
            <Route path="/catalog" element={<ProtectedRoute><ServiceCatalog /></ProtectedRoute>} />
            <Route path="/catalog/admin" element={<ProtectedRoute><ServiceCatalogAdmin /></ProtectedRoute>} />
            <Route path="/problems" element={<ProtectedRoute><Problems /></ProtectedRoute>} />
            <Route path="/problems/:id" element={<ProtectedRoute><ProblemDetail /></ProtectedRoute>} />
            <Route path="/major-incidents" element={<ProtectedRoute><MajorIncidents /></ProtectedRoute>} />
            <Route path="/major-incidents/:id" element={<ProtectedRoute><MajorIncidentDetail /></ProtectedRoute>} />
            <Route path="/status/admin" element={<ProtectedRoute><StatusPageAdmin /></ProtectedRoute>} />
            <Route path="/status" element={<StatusPagePublic />} />
            <Route path="/help" element={<Navigate to="/portal" replace />} />
            <Route path="/help/article/:id" element={<HelpArticle />} />
            <Route path="/help/submit" element={<Navigate to="/portal/new" replace />} />
            <Route path="/help/my-tickets" element={<Navigate to="/portal/tickets" replace />} />
            <Route path="/support/sla" element={<ProtectedRoute><SLAManagement /></ProtectedRoute>} />
            <Route path="/assets" element={<ProtectedRoute><AssetManagement /></ProtectedRoute>} />
            <Route path="/support/analytics" element={<ProtectedRoute><HelpdeskAnalytics /></ProtectedRoute>} />
            <Route path="/support/csat" element={<ProtectedRoute><CSATDashboard /></ProtectedRoute>} />
            <Route path="/csat/:token" element={<CSATSurvey />} />
            <Route path="/support/intake" element={<ProtectedRoute><TicketIntake /></ProtectedRoute>} />
            <Route path="/support/email-intake" element={<ProtectedRoute><EmailIntake /></ProtectedRoute>} />
            <Route path="/support/macros" element={<ProtectedRoute><MacrosPage /></ProtectedRoute>} />
            <Route path="/support/sla-escalation" element={<ProtectedRoute><SLAEscalationRules /></ProtectedRoute>} />
            <Route path="/support/approvals" element={<ProtectedRoute><ApprovalChainsPage /></ProtectedRoute>} />
            <Route path="/support/reports" element={<ProtectedRoute><HelpdeskReportsPage /></ProtectedRoute>} />
            <Route path="/portal" element={<ProtectedRoute><CustomerPortalLayout /></ProtectedRoute>}>
              <Route index element={<PortalDashboard />} />
              <Route path="tickets" element={<PortalTicketList />} />
              <Route path="tickets/:id" element={<PortalTicketDetail />} />
              <Route path="new" element={<PortalNewTicket />} />
              <Route path="kb" element={<PortalKB />} />
              <Route path="kb/:id" element={<PortalKBArticle />} />
              <Route path="catalog" element={<PortalCatalog />} />
              <Route path="training" element={<PortalTraining />} />
            </Route>
            <Route path="/change-management/workflows" element={<ProtectedRoute><CMWorkflows /></ProtectedRoute>} />
            <Route path="/change-management" element={<ProtectedRoute><ChangeManagement /></ProtectedRoute>} />
            <Route path="/change-management/portal" element={<ProtectedRoute><ChangeControlPortal /></ProtectedRoute>} />
            <Route path="/change-management/my-changes" element={<ProtectedRoute><MyChanges /></ProtectedRoute>} />
            <Route path="/change-management/settings" element={<ProtectedRoute><ChangeManagementSettings /></ProtectedRoute>} />
            <Route path="/change-management/:id" element={<ProtectedRoute><ChangeManagementDetail /></ProtectedRoute>} />
            <Route path="/governance" element={<ProtectedRoute><Governance /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/stakeholder-portal" element={<ProtectedRoute><StakeholderPortal /></ProtectedRoute>} />
            <Route path="/ai-approvals" element={<ProtectedRoute><AIApprovals /></ProtectedRoute>} />
            <Route path="/ai-wizards" element={<ProtectedRoute><AIWizards /></ProtectedRoute>} />
            <Route path="/ai-advisor" element={<ProtectedRoute><AIAdvisor /></ProtectedRoute>} />
            <Route path="/ai-insights" element={<ProtectedRoute><AIInsights /></ProtectedRoute>} />
            <Route path="/knowledgebase" element={<ProtectedRoute><Knowledgebase /></ProtectedRoute>} />
            <Route path="/knowledgebase/:id" element={<ProtectedRoute><KnowledgebaseArticle /></ProtectedRoute>} />
            <Route path="/admin/automations" element={<ProtectedRoute><Automations /></ProtectedRoute>} />
            {/* Industry vertical pages */}
            <Route path="/construction/rfis" element={<ProtectedRoute><RFIs /></ProtectedRoute>} />
            <Route path="/construction/submittals" element={<ProtectedRoute><Submittals /></ProtectedRoute>} />
            <Route path="/construction/daily-logs" element={<ProtectedRoute><DailyLogs /></ProtectedRoute>} />
            <Route path="/construction/punch-list" element={<ProtectedRoute><PunchList /></ProtectedRoute>} />
            <Route path="/services/engagements" element={<ProtectedRoute><Engagements /></ProtectedRoute>} />
            <Route path="/services/retainers" element={<ProtectedRoute><Retainers /></ProtectedRoute>} />
            <Route path="/verticals/docs" element={<ProtectedRoute><VerticalsDocs /></ProtectedRoute>} />
            <Route path="/verticals/:slug" element={<ProtectedRoute><VerticalEntityRegister /></ProtectedRoute>} />
            <Route path="/learning" element={<ProtectedRoute><LmsCatalog /></ProtectedRoute>} />
            <Route path="/learning/my" element={<ProtectedRoute><MyLearning /></ProtectedRoute>} />
            <Route path="/learning/courses/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="/learning/admin" element={<ProtectedRoute><LmsAdmin /></ProtectedRoute>} />
            <Route path="/learning/admin/courses/:id" element={<ProtectedRoute><LmsCourseEditor /></ProtectedRoute>} />
            <Route path="/learning/admin/lessons/:id/quiz" element={<ProtectedRoute><LmsQuizEditor /></ProtectedRoute>} />
            <Route path="/learning/dashboard" element={<ProtectedRoute><LmsManagerDashboard /></ProtectedRoute>} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
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
