import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Headset } from "lucide-react";
import { Fragment } from "react";

export type Crumb = { label: string; to?: string };

interface HelpdeskBreadcrumbsProps {
  /** Extra terminal crumb(s) appended after the auto-derived trail (e.g. ticket reference). */
  trail?: Crumb[];
  className?: string;
}

/**
 * Breadcrumbs for the help desk area. Auto-derives the parent path from the
 * current route, then appends any caller-supplied terminal crumbs.
 *
 * Hierarchy:
 *   Helpdesk › Agent Console
 *   Helpdesk › Get Support
 *   Helpdesk › My Tickets
 *   Helpdesk › Agent Console › Ticket TKT-0001
 *   Helpdesk › Workflows
 */
export function HelpdeskBreadcrumbs({ trail = [], className }: HelpdeskBreadcrumbsProps) {
  const { pathname } = useLocation();

  const base: Crumb[] = [{ label: "Helpdesk", to: "/support" }];

  if (pathname.startsWith("/support/portal")) {
    base.push({ label: "Get Support", to: "/support/portal" });
  } else if (pathname.startsWith("/support/my-tickets")) {
    base.push({ label: "My Tickets", to: "/support/my-tickets" });
  } else if (pathname.startsWith("/support/workflows")) {
    base.push({ label: "Workflows", to: "/support/workflows" });
  } else if (pathname.startsWith("/support/tickets/")) {
    base.push({ label: "Agent Console", to: "/support" });
  } else if (pathname.startsWith("/support/legacy")) {
    base.push({ label: "Legacy View", to: "/support/legacy" });
  } else if (pathname === "/support") {
    base.push({ label: "Agent Console" });
  }

  const all = [...base, ...trail];

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {all.map((c, i) => {
          const isLast = i === all.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              <BreadcrumbItem>
                {isLast || !c.to ? (
                  <BreadcrumbPage className="flex items-center gap-1.5">
                    {i === 0 && <Headset className="h-3.5 w-3.5" />}
                    {c.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={c.to} className="flex items-center gap-1.5 hover:text-foreground">
                      {i === 0 && <Headset className="h-3.5 w-3.5" />}
                      {c.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
