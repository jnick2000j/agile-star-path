import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExternalTrainingPanel } from "@/components/lms/ExternalTrainingPanel";
import {
  CatalogView,
  LearningStats,
  MyCertificatesView,
  MyEnrollmentsView,
} from "@/components/lms/LearningViews";

export default function PortalTraining() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Training</h1>
        <p className="text-sm text-muted-foreground">
          Browse the catalog, track your progress, download certificates, and log external training.
        </p>
      </div>

      <LearningStats />

      <Tabs defaultValue="in_progress" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="in_progress">In progress</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="external">External training</TabsTrigger>
        </TabsList>

        <TabsContent value="in_progress">
          <MyEnrollmentsView filter="in_progress" />
        </TabsContent>

        <TabsContent value="catalog">
          <CatalogView />
        </TabsContent>

        <TabsContent value="completed">
          <MyEnrollmentsView filter="completed" />
        </TabsContent>

        <TabsContent value="certificates">
          <MyCertificatesView />
        </TabsContent>

        <TabsContent value="external">
          <ExternalTrainingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
