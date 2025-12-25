import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TaskMasterChat } from "@/components/TaskMasterChat";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Programmes from "./pages/Programmes";
import ProgrammeBlueprint from "./pages/ProgrammeBlueprint";
import ProgrammeTranches from "./pages/ProgrammeTranches";
import Projects from "./pages/Projects";
import ProjectBriefs from "./pages/ProjectBriefs";
import WorkPackages from "./pages/WorkPackages";
import Products from "./pages/Products";
import ProductRoadmap from "./pages/ProductRoadmap";
import FeatureBacklog from "./pages/FeatureBacklog";
import SprintPlanning from "./pages/SprintPlanning";
import FeatureDependencies from "./pages/FeatureDependencies";
import RiskRegister from "./pages/RiskRegister";
import IssueRegister from "./pages/IssueRegister";
import BenefitsRegister from "./pages/BenefitsRegister";
import StakeholderRegister from "./pages/StakeholderRegister";
import LessonsLearned from "./pages/LessonsLearned";
import Documentation from "./pages/Documentation";
import WeeklyUpdates from "./pages/WeeklyUpdates";
import Reports from "./pages/Reports";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";
import BrandingSettings from "./pages/BrandingSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/programmes" element={<ProtectedRoute><Programmes /></ProtectedRoute>} />
            <Route path="/programmes/blueprint" element={<ProtectedRoute><ProgrammeBlueprint /></ProtectedRoute>} />
            <Route path="/programmes/tranches" element={<ProtectedRoute><ProgrammeTranches /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/projects/briefs" element={<ProtectedRoute><ProjectBriefs /></ProtectedRoute>} />
            <Route path="/projects/work-packages" element={<ProtectedRoute><WorkPackages /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/products/roadmap" element={<ProtectedRoute><ProductRoadmap /></ProtectedRoute>} />
            <Route path="/products/features" element={<ProtectedRoute><FeatureBacklog /></ProtectedRoute>} />
            <Route path="/products/sprints" element={<ProtectedRoute><SprintPlanning /></ProtectedRoute>} />
            <Route path="/products/dependencies" element={<ProtectedRoute><FeatureDependencies /></ProtectedRoute>} />
            <Route path="/registers/risks" element={<ProtectedRoute><RiskRegister /></ProtectedRoute>} />
            <Route path="/registers/issues" element={<ProtectedRoute><IssueRegister /></ProtectedRoute>} />
            <Route path="/registers/benefits" element={<ProtectedRoute><BenefitsRegister /></ProtectedRoute>} />
            <Route path="/registers/stakeholders" element={<ProtectedRoute><StakeholderRegister /></ProtectedRoute>} />
            <Route path="/registers/lessons" element={<ProtectedRoute><LessonsLearned /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/weekly-updates" element={<ProtectedRoute><WeeklyUpdates /></ProtectedRoute>} />
            <Route path="/documentation" element={<ProtectedRoute><Documentation /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/branding" element={<ProtectedRoute><BrandingSettings /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requiredRoles={["admin"]}><AdminPanel /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <TaskMasterChat />
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
