import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Programmes from "./pages/Programmes";
import Projects from "./pages/Projects";
import RiskRegister from "./pages/RiskRegister";
import IssueRegister from "./pages/IssueRegister";
import BenefitsRegister from "./pages/BenefitsRegister";
import StakeholderRegister from "./pages/StakeholderRegister";
import Documentation from "./pages/Documentation";
import WeeklyUpdates from "./pages/WeeklyUpdates";
import Reports from "./pages/Reports";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/programmes" element={<Programmes />} />
          <Route path="/programmes/blueprint" element={<Programmes />} />
          <Route path="/programmes/tranches" element={<Programmes />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/briefs" element={<Projects />} />
          <Route path="/projects/work-packages" element={<Projects />} />
          <Route path="/registers/risks" element={<RiskRegister />} />
          <Route path="/registers/issues" element={<IssueRegister />} />
          <Route path="/registers/benefits" element={<BenefitsRegister />} />
          <Route path="/registers/stakeholders" element={<StakeholderRegister />} />
          <Route path="/registers/lessons" element={<RiskRegister />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/weekly-updates" element={<WeeklyUpdates />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/team" element={<Team />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
