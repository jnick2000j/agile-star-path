import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StakeholderAccessSettings from "@/components/admin/StakeholderAccessSettings";
import { 
  Save, 
  Bell,
  Mail,
  Shield,
  Palette,
  Globe
} from "lucide-react";

export default function Settings() {
  return (
    <AppLayout title="Settings" subtitle="Configure your platform preferences">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="email">Email Reports</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholder Access</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="metric-card max-w-2xl">
            <h3 className="text-lg font-semibold mb-6">General Settings</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input id="orgName" defaultValue="Acme Corporation" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" defaultValue="Europe/London (GMT+0)" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date Format</Label>
                <Input id="dateFormat" defaultValue="DD MMM YYYY" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Enable dark theme across the platform</p>
                </div>
                <Switch />
              </div>

              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="metric-card max-w-2xl">
            <h3 className="text-lg font-semibold mb-6">Notification Preferences</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Risk Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when new high-priority risks are identified</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Issue Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive alerts for new issues and status changes</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Milestone Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get reminded about upcoming milestones</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">Receive weekly summary of programme activities</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Stakeholder Updates</Label>
                  <p className="text-sm text-muted-foreground">Notify when stakeholder engagement changes</p>
                </div>
                <Switch />
              </div>

              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Save Preferences
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="email">
          <div className="metric-card max-w-2xl">
            <h3 className="text-lg font-semibold mb-6">Automated Email Reports</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Automated Reports</Label>
                  <p className="text-sm text-muted-foreground">Automatically send scheduled reports via email</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportRecipients">Default Recipients</Label>
                <Input id="reportRecipients" defaultValue="executives@company.com, pmo@company.com" />
                <p className="text-xs text-muted-foreground">Comma-separated email addresses</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportTime">Report Delivery Time</Label>
                <Input id="reportTime" type="time" defaultValue="08:00" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Risk Summary</Label>
                  <p className="text-sm text-muted-foreground">Add risk overview section to reports</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Benefits Progress</Label>
                  <p className="text-sm text-muted-foreground">Add benefits realization charts</p>
                </div>
                <Switch defaultChecked />
              </div>

              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Save Email Settings
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="metric-card max-w-2xl">
            <h3 className="text-lg font-semibold mb-6">Security Settings</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">Automatically log out inactive users</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout Duration (minutes)</Label>
                <Input id="timeout" type="number" defaultValue="30" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Audit Logging</Label>
                  <p className="text-sm text-muted-foreground">Log all user actions for compliance</p>
                </div>
                <Switch defaultChecked />
              </div>

              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Save Security Settings
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stakeholders">
          <StakeholderAccessSettings />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
