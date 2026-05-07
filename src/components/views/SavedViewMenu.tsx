import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  Plus,
  Star,
  Trash2,
  Users,
  Lock,
  Pencil,
  RotateCcw,
  Save,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useSavedViews, type SavedView } from "@/hooks/useSavedViews";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SavedViewMenuProps {
  scope: string;
  views: ReturnType<typeof useSavedViews>;
  showAssignmentChips?: boolean;
  /** Indicates user has unsaved changes vs the active view */
  dirty?: boolean;
  /** Save current state into the active view */
  onSaveActive?: () => void;
  /** Reset back to the saved view's config */
  onReset?: () => void;
}

const ASSIGNMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "me", label: "Me" },
  { value: "my_team", label: "My team" },
  { value: "created_by_me", label: "Created by me" },
  { value: "mentioned_me", label: "Mentioned me" },
  { value: "unassigned", label: "Unassigned" },
];

export function SavedViewMenu({
  scope,
  views,
  showAssignmentChips = true,
  dirty,
  onSaveActive,
  onReset,
}: SavedViewMenuProps) {
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

  const assignmentLabel =
    ASSIGNMENT_OPTIONS.find((o) => o.value === activeConfig.assignment)?.label;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* View switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 font-medium hover:bg-muted/60 px-2"
          >
            <Bookmark className="h-3.5 w-3.5 text-primary" />
            <span className="max-w-[200px] truncate">
              {activeView ? activeView.name : "All items"}
            </span>
            {dirty && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-warning"
                title="Unsaved changes"
              />
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
            Saved views
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => selectView(null)} className="gap-2">
            <Check className={cn("h-3.5 w-3.5", !activeView ? "opacity-100" : "opacity-0")} />
            <span className="flex-1">All items (no view)</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {list.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No saved views yet. Configure filters & columns, then save.
            </div>
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
              <Check
                className={cn(
                  "h-3.5 w-3.5 mt-0.5",
                  activeView?.id === v.id ? "opacity-100" : "opacity-0"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{v.name}</span>
                  {v.is_shared ? (
                    <Users className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                  {orgDefaultId === v.id && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      org default
                    </Badge>
                  )}
                  {myDefaultId === v.id && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      my default
                    </Badge>
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
                  <Star className={cn("h-3.5 w-3.5", myDefaultId === v.id && "fill-current")} />
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

      {/* Dirty state actions */}
      {dirty && activeView && onSaveActive && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-warning hover:text-warning"
            onClick={onSaveActive}
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={onReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </>
      )}

      {/* Assignment dropdown */}
      {showAssignmentChips && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-foreground">
              <span className="text-xs">Assignment</span>
              {assignmentLabel && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {assignmentLabel}
                </Badge>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-1">
            <button
              type="button"
              onClick={() => setActiveConfig({ ...activeConfig, assignment: null })}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/60",
                !activeConfig.assignment && "bg-muted/40"
              )}
            >
              <Check
                className={cn("h-3.5 w-3.5", !activeConfig.assignment ? "opacity-100" : "opacity-0")}
              />
              Anyone
            </button>
            {ASSIGNMENT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setActiveConfig({ ...activeConfig, assignment: o.value })}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/60",
                  activeConfig.assignment === o.value && "bg-muted/40"
                )}
              >
                <Check
                  className={cn(
                    "h-3.5 w-3.5",
                    activeConfig.assignment === o.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {o.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
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
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>{editTarget ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
