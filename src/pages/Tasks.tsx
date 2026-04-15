import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListTodo, Calendar, Layers } from "lucide-react";
import TaskManagement from "./TaskManagement";
import SprintPlanning from "./SprintPlanning";
import UnifiedBacklog from "./UnifiedBacklog";

export default function Tasks() {
  return (
    <AppLayout title="Tasks" subtitle="Task management, sprint planning, and unified backlog">
      <Tabs defaultValue="tasks" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" />
            Task Management
          </TabsTrigger>
          <TabsTrigger value="sprints" className="gap-2">
            <Calendar className="h-4 w-4" />
            Sprint Planning
          </TabsTrigger>
          <TabsTrigger value="backlog" className="gap-2">
            <Layers className="h-4 w-4" />
            Unified Backlog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <TaskManagement embedded />
        </TabsContent>
        <TabsContent value="sprints">
          <SprintPlanning embedded />
        </TabsContent>
        <TabsContent value="backlog">
          <UnifiedBacklog embedded />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
