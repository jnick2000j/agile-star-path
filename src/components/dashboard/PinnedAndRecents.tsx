import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pin, PinOff, Clock, FolderKanban, Layers, Package, ListTodo } from "lucide-react";
import { useRecents } from "@/hooks/useRecents";
import { usePinnedEntities } from "@/hooks/usePinnedEntities";
import { formatDistanceToNow } from "date-fns";

const ICONS: Record<string, React.ElementType> = {
  project: FolderKanban,
  programme: Layers,
  product: Package,
  task: ListTodo,
};

export function PinnedAndRecents() {
  const { data: recents = [] } = useRecents(8);
  const { pinned, pin, unpin } = usePinnedEntities();

  const pinnedKeys = new Set(pinned.map((p) => `${p.entity_type}:${p.entity_id}:${p.href}`));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Pinned */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Pin className="h-4 w-4" /> Pinned
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pinned.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Pin items from the Recents list →<br />
              <span className="text-xs">Or pin from any project / programme / product page.</span>
            </p>
          ) : (
            <ul className="space-y-1">
              {pinned.map((p) => {
                const Icon = ICONS[p.entity_type] || FolderKanban;
                return (
                  <li
                    key={p.id}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <Link to={p.href} className="flex items-center gap-2 flex-1 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{p.label}</span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => unpin(p.id)}
                      title="Unpin"
                    >
                      <PinOff className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" /> Recents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Items you open will show up here.
            </p>
          ) : (
            <ul className="space-y-1">
              {recents.map((r) => {
                const Icon = ICONS[r.entity_type] || FolderKanban;
                const key = `${r.entity_type}:${r.entity_id}:${r.href}`;
                const isPinned = pinnedKeys.has(key);
                return (
                  <li
                    key={r.id}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <Link to={r.href} className="flex items-center gap-2 flex-1 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{r.label}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-auto">
                        {formatDistanceToNow(new Date(r.viewed_at), { addSuffix: true })}
                      </span>
                    </Link>
                    {!isPinned && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() =>
                          pin({
                            entity_type: r.entity_type,
                            entity_id: r.entity_id,
                            label: r.label,
                            href: r.href,
                          })
                        }
                        title="Pin to dashboard"
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
