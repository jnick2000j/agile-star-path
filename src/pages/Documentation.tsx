import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Search, 
  BookOpen,
  FileText,
  ExternalLink,
  Download
} from "lucide-react";

const prince2Principles = [
  { title: "Continued Business Justification", description: "A valid business reason must exist throughout the project lifecycle. The project should remain viable and the expected benefits should justify the investment." },
  { title: "Learn from Experience", description: "Teams should seek and use lessons from previous projects. New lessons are recorded for future use." },
  { title: "Defined Roles and Responsibilities", description: "Clear roles and responsibilities within an organizational structure that engages business, user, and supplier stakeholder interests." },
  { title: "Manage by Stages", description: "Projects are planned, monitored, and controlled on a stage-by-stage basis. Stages provide senior management with control points for decision-making." },
  { title: "Manage by Exception", description: "Establishing tolerances for each project objective and delegating authority to the appropriate level. Escalation only when tolerances are forecast to be exceeded." },
  { title: "Focus on Products", description: "Projects focus on the definition and delivery of products, particularly their quality requirements." },
  { title: "Tailor to Suit the Project Environment", description: "PRINCE2 is tailored to suit the project's environment, size, complexity, importance, capability, and risk." },
];

const mspPrinciples = [
  { title: "Remaining Aligned with Corporate Strategy", description: "The programme must remain aligned with the organization's strategic objectives throughout its lifecycle." },
  { title: "Leading Change", description: "Transformation requires active leadership to drive change across the organization and overcome resistance." },
  { title: "Envisioning and Communicating a Better Future", description: "A compelling vision must be developed and communicated to stakeholders to generate support and commitment." },
  { title: "Focusing on Benefits and Threats to Them", description: "Benefits realization is the primary measure of programme success. Threats must be actively managed." },
  { title: "Adding Value", description: "The programme must deliver more value than the sum of its component projects." },
  { title: "Designing and Delivering a Coherent Capability", description: "Projects must be coordinated to deliver capabilities that enable benefit realization." },
  { title: "Learning from Experience", description: "Continuous improvement through capturing and applying lessons learned." },
];

const agilePrinciples = [
  { title: "Customer Satisfaction", description: "Our highest priority is to satisfy the customer through early and continuous delivery of valuable software." },
  { title: "Welcome Change", description: "Welcome changing requirements, even late in development. Agile processes harness change for the customer's competitive advantage." },
  { title: "Frequent Delivery", description: "Deliver working software frequently, from a couple of weeks to a couple of months, with a preference to the shorter timescale." },
  { title: "Collaboration", description: "Business people and developers must work together daily throughout the project." },
  { title: "Motivated Individuals", description: "Build projects around motivated individuals. Give them the environment and support they need, and trust them to get the job done." },
  { title: "Face-to-Face Communication", description: "The most efficient and effective method of conveying information is face-to-face conversation." },
  { title: "Working Software", description: "Working software is the primary measure of progress." },
  { title: "Sustainable Development", description: "Agile processes promote sustainable development. The sponsors, developers, and users should be able to maintain a constant pace indefinitely." },
  { title: "Technical Excellence", description: "Continuous attention to technical excellence and good design enhances agility." },
  { title: "Simplicity", description: "Simplicity—the art of maximizing the amount of work not done—is essential." },
  { title: "Self-Organizing Teams", description: "The best architectures, requirements, and designs emerge from self-organizing teams." },
  { title: "Reflect and Adjust", description: "At regular intervals, the team reflects on how to become more effective, then tunes and adjusts its behavior accordingly." },
];

const documents = [
  { name: "Programme Mandate Template", category: "MSP", type: "Template" },
  { name: "Programme Brief Template", category: "MSP", type: "Template" },
  { name: "Programme Blueprint Template", category: "MSP", type: "Template" },
  { name: "Benefits Realization Plan", category: "MSP", type: "Template" },
  { name: "Stakeholder Engagement Strategy", category: "MSP", type: "Template" },
  { name: "Project Brief Template", category: "PRINCE2", type: "Template" },
  { name: "Business Case Template", category: "PRINCE2", type: "Template" },
  { name: "Risk Register Template", category: "PRINCE2", type: "Template" },
  { name: "Issue Register Template", category: "PRINCE2", type: "Template" },
  { name: "Lessons Learned Log", category: "PRINCE2", type: "Template" },
  { name: "Product Description Template", category: "PRINCE2", type: "Template" },
  { name: "Sprint Planning Guide", category: "Agile", type: "Guide" },
  { name: "Daily Standup Guidelines", category: "Agile", type: "Guide" },
  { name: "Sprint Retrospective Template", category: "Agile", type: "Template" },
  { name: "User Story Template", category: "Agile", type: "Template" },
  { name: "Definition of Done Checklist", category: "Agile", type: "Checklist" },
];

export default function Documentation() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDocs = documents.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Documentation" subtitle="PRINCE2 MSP, Agile & Project Management resources">
      {/* Search */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs defaultValue="principles" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="principles">Principles</TabsTrigger>
          <TabsTrigger value="templates">Templates & Guides</TabsTrigger>
          <TabsTrigger value="processes">Processes</TabsTrigger>
        </TabsList>

        <TabsContent value="principles" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* PRINCE2 Principles */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">PRINCE2 Principles</h3>
                  <p className="text-sm text-muted-foreground">Project Management</p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {prince2Principles.map((principle, index) => (
                  <AccordionItem key={index} value={`prince2-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {principle.title}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {principle.description}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* MSP Principles */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <BookOpen className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold">MSP Principles</h3>
                  <p className="text-sm text-muted-foreground">Programme Management</p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {mspPrinciples.map((principle, index) => (
                  <AccordionItem key={index} value={`msp-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {principle.title}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {principle.description}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Agile Principles */}
            <div className="metric-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <BookOpen className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold">Agile Principles</h3>
                  <p className="text-sm text-muted-foreground">Agile Manifesto</p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {agilePrinciples.map((principle, index) => (
                  <AccordionItem key={index} value={`agile-${index}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {principle.title}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {principle.description}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="metric-card">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDocs.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                        <Badge variant="secondary" className="text-xs">{doc.type}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="processes">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="metric-card">
              <h3 className="font-semibold mb-4">PRINCE2 Processes</h3>
              <div className="space-y-3">
                {[
                  "Starting Up a Project (SU)",
                  "Directing a Project (DP)",
                  "Initiating a Project (IP)",
                  "Controlling a Stage (CS)",
                  "Managing Product Delivery (MP)",
                  "Managing a Stage Boundary (SB)",
                  "Closing a Project (CP)",
                ].map((process, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <span className="text-sm">{process}</span>
                    <Button variant="ghost" size="sm" className="gap-1">
                      Learn More
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="metric-card">
              <h3 className="font-semibold mb-4">MSP Transformational Flow</h3>
              <div className="space-y-3">
                {[
                  "Identifying a Programme",
                  "Defining a Programme",
                  "Managing the Tranches",
                  "Delivering the Capability",
                  "Realizing the Benefits",
                  "Closing a Programme",
                ].map((phase, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <span className="text-sm">{phase}</span>
                    <Button variant="ghost" size="sm" className="gap-1">
                      Learn More
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
