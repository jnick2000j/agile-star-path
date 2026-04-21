import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldOff, LifeBuoy, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface DisabledMemberBlockProps {
  organizationName?: string | null;
  reason?: string | null;
}

export function DisabledMemberBlock({ organizationName, reason }: DisabledMemberBlockProps) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldOff className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle>Your access has been disabled</CardTitle>
          <CardDescription>
            An administrator has disabled your access to{" "}
            <span className="font-medium text-foreground">
              {organizationName || "this organization"}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason && (
            <Alert>
              <AlertTitle>Reason provided</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">{reason}</AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            You can still access any other organizations you belong to. Contact an organization
            administrator if you believe this was a mistake.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/support">
                <LifeBuoy className="h-4 w-4 mr-2" />
                Contact support
              </Link>
            </Button>
            <Button variant="ghost" className="flex-1" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
