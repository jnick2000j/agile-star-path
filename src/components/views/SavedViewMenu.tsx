import { useState } from "react";
import { Bookmark, ChevronDown, Plus, Star, Trash2, Users, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSavedViews, type SavedView } from "@/hooks/useSavedViews";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface SavedViewMenuProps {
  scope: string;
  views: ReturnType<typeof useSavedViews>;
  /** Show assignment chip group */
  showAssignmentChips?: boolean;
}

const ASSIGNMENT_OPTIONS = [
  { value: "me", label: "Me" },
  { value: "my_team", label: "My team" },
  { value: "created_by_me", label: "Created by me" },
  { value: "mentioned_me", label: "Mentioned me" },
  { value: "unassigned", label: "Unassigned" },
];

export function SavedViewMenu({ scope, views, showAssignmentChips = true }: SavedViewMenuProps) {
  const {
    views: list,
    activeView,
    activeConfig,
    setActiveConfig,
    selectView,
    saveView,
    deleteView,
    setOrgDefault,
    setMyDefault,
    orgDefaultId,
    myDefaultId,
  } = views;

  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user || !currentOrganization) return;
      const { data } = await supabase.rpc("is_org_admin", {
        _user_id: user.id,
        _org_id: currentOrganization.id,
      } as any);
      if (!cancelled) setIsAdmin(!!data);
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [user, currentOrganization]);

  const [saveOpen, setSaveOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SavedView | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);

  const openCreate = () => {
    setEditTarget(null);
    setName("");
    setDescription("");
    setIsShared(false);
    setSaveOpen(true);
  };

  const openEdit = (v: SavedView) => {
    setEditTarget(v);
    setName(v.name);
    setDescription(v.description ?? "");
    setIsShared(v.is_shared);
    setSaveOpen(true);
  };

  const submit = async () => {
    if (!name.trim()) return;
    await saveView({
      name: name.trim(),
      description,
      is_shared: isAdmin ? isShared : false,
      id: editTarget?.id,
    });
    setSaveOpen(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark className="h-4 w-4" />
            <span className="max-w-[180px] truncate">
              {activeView ? activeView.name : "Default view"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => selectView(null)}>
            <span className="flex-1">Default (no view)</span>
            {!activeView && <Badge variant="secondary" className="ml-2">active</Badge>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {list.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">No saved views yet.</div>
          )}
          {list.map((v) => (
            <DropdownMenuItem
              key={v.id}
              onSelect={(e) => {
                e.preventDefault();
                selectView(v.id);
              }}
              className="flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{v.name}</span>
                  {v.is_shared ? (
                    <Users className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                  {orgDefaultId === v.id && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">org default</Badge>
                  )}
                  {myDefaultId === v.id && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">my default</Badge>
                  )}
                </div>
                {v.description && (
                  <div className="text-xs text-muted-foreground truncate">{v.description}</div>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMyDefault(myDefaultId === v.id ? null : v.id);
                  }}
                  title={myDefaultId === v.id ? "Clear my default" : "Set as my default"}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${myDefaultId === v.id ? "fill-current" : ""}`}
                  />
                </Button>
                {(v.owner_user_id === user?.id || (v.is_shared && isAdmin)) && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(v);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteView(v.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openCreate(); }}>
            <Plus className="h-4 w-4 mr-2" /> Save current as new view…
          </DropdownMenuItem>
          {isAdmin && activeView && activeView.is_shared && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setOrgDefault(orgDefaultId === activeView.id ? null : activeView.id);
              }}
            >
              <Star className="h-4 w-4 mr-2" />
              {orgDefaultId === activeView.id ? "Remove org default" : "Set as org default"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showAssignmentChips && (
        <ToggleGroup
          type="single"
          size="sm"
          value={activeConfig.assignment ?? ""}
          onValueChange={(val) =>
            setActiveConfig({ ...activeConfig, assignment: val || null })
          }
          className="flex-wrap"
        >
          {ASSIGNMENT_OPTIONS.map((opt) => (
            <ToggleGroupItem key={opt.value} value={opt.value} className="h-8 text-xs">
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit view" : "Save view"}</DialogTitle>
            <DialogDescription>
              Captures filters, sort, columns, grouping, and layout for this page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="view-name">Name</Label>
              <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="view-desc">Description (optional)</Label>
              <Textarea
                id="view-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Share with organization</div>
                  <div className="text-xs text-muted-foreground">
                    Visible to all members. Only org admins can manage shared views.
                  </div>
                </div>
                <Switch checked={isShared} onCheckedChange={setIsShared} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={submit}>{editTarget ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
