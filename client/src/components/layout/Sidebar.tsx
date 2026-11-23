import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BookOpenText,
  FileText,
  Braces,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  Globe2,
  House,
  Images,
  LayoutDashboard,
  ListTodo,
  MonitorPlay,
  Radar,
  SquareStack,
  ScanSearch,
  Settings2,
  ShieldCheck,
  SquarePen,
  Tags,
  UsersRound,
  WandSparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { listKnowledgeDocuments } from "@/api/knowledge";
import { queryKeys } from "@/api/queryKeys";
import { getAutoDirectorFollowUpOverview } from "@/api/autoDirectorFollowUps";
import { getTaskOverview } from "@/api/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VisualAssetLibraryDialog } from "@/components/visualAssets";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  action?: "visual_asset_library";
  disabled?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Crear",
    items: [
      { to: "/", label: "Pagina de inicio", icon: House },
      { to: "/help", label: "Asistente de creación", icon: CircleHelp },
      { to: "/market-radar", label: "Radar de temas candentes", icon: Radar },
      { to: "/novels", label: "Lista de novelas", icon: BookOpenText },
      { to: "/outlines", label: "Esquema", icon: FileText },
      { to: "/drama", label: "Banco de trabajo de drama corto", icon: MonitorPlay, disabled: true },
      { to: "/comic", label: "Banco de trabajo cómico", icon: SquareStack },
      { to: "/creative-hub", label: "Centro creativo", icon: LayoutDashboard },
      { to: "/book-analysis", label: "Abre el libro", icon: ScanSearch },
    ],
  },
  {
    title: "Activos",
    items: [
      { to: "/genres", label: "Biblioteca base de temas", icon: Tags },
      { to: "/story-modes", label: "Biblioteca de patrones avanzada", icon: Workflow },
      { to: "/titles", label: "Taller de titulo", icon: SquarePen },
      { to: "/knowledge", label: "Base de conocimientos", icon: Database },
      { to: "/worlds", label: "Biblioteca mundial de muestras", icon: Globe2 },
      { to: "/style-engine", label: "Motor de escritura", icon: WandSparkles },
      { to: "/anti-ai-rules", label: "Reglas anti-IA", icon: ShieldCheck },
      { to: "/base-characters", label: "Biblioteca de personajes básicos", icon: UsersRound },
      { to: "#visual-assets", label: "Biblioteca de recursos visuales", icon: Images, action: "visual_asset_library" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/tasks", label: "Registro de operación", icon: ListTodo },
      { to: "/auto-director/follow-ups", label: "Seguimiento del director", icon: Workflow },
      { to: "/prompt-workbench", label: "Gestión rápida de palabras", icon: Braces },
      { to: "/settings", label: "Ajustes del sistema", icon: Settings2 },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function ProjectNavigation({ collapsed = false, className, onNavigate, onOpenVisualAssets }: {
  collapsed?: boolean;
  className: string;
  onNavigate?: () => void;
  onOpenVisualAssets: () => void;
}) {
  const [badgeQueriesEnabled, setBadgeQueriesEnabled] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setBadgeQueriesEnabled(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const taskQuery = useQuery({
    queryKey: queryKeys.tasks.overview,
    queryFn: getTaskOverview,
    enabled: badgeQueriesEnabled,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const overview = query.state.data?.data;
      return (overview?.queuedCount ?? 0) > 0 || (overview?.runningCount ?? 0) > 0 ? 4000 : false;
    },
  });

  const knowledgeQuery = useQuery({
    queryKey: queryKeys.knowledge.documents("sidebar"),
    queryFn: () => listKnowledgeDocuments(),
    enabled: badgeQueriesEnabled,
    staleTime: 30_000,
  });

  const autoDirectorFollowUpQuery = useQuery({
    queryKey: queryKeys.autoDirectorFollowUps.overview,
    queryFn: getAutoDirectorFollowUpOverview,
    enabled: badgeQueriesEnabled,
    refetchInterval: (query) => {
      const totalCount = query.state.data?.data?.totalCount ?? 0;
      return totalCount > 0 ? 4000 : false;
    },
  });

  const failedTaskCount = taskQuery.data?.data?.failedCount ?? 0;
  const autoDirectorFollowUpCount = autoDirectorFollowUpQuery.data?.data?.totalCount ?? 0;
  const knowledgeDocuments = knowledgeQuery.data?.data ?? [];
  const failedIndexCount = knowledgeDocuments.filter((item) => item.latestIndexStatus === "failed").length;

  const renderBadge = (to: string) => {
    if (to === "/comic") {
      if (collapsed) {
        return null;
      }
      return (
        <Badge
          variant="outline"
          className="ml-auto h-5 border-amber-300 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700"
          title="Comics Workbench todavía está en fase beta"
        >
          Beta
        </Badge>
      );
    }

    if (to === "/tasks") {
      if (failedTaskCount <= 0) {
        return null;
      }
      return (
        <div className={cn("flex items-center gap-1", collapsed ? "absolute right-1 top-1" : "ml-auto")}>
          <Badge
            variant="destructive"
            className={cn("h-5 px-1.5 text-[10px]", collapsed && "h-4 min-w-4 px-1 text-[9px]")}
          >
            {collapsed ? failedTaskCount : `F${failedTaskCount}`}
          </Badge>
        </div>
      );
    }

    if (to === "/auto-director/follow-ups" && autoDirectorFollowUpCount > 0) {
      return (
        <Badge
          variant="destructive"
          className={cn(
            "h-5 px-1.5 text-[10px]",
            collapsed ? "absolute right-1 top-1 h-4 min-w-4 px-1 text-[9px]" : "ml-auto",
          )}
        >
          {autoDirectorFollowUpCount}
        </Badge>
      );
    }

    if (to === "/knowledge" && failedIndexCount > 0) {
      return (
        <Badge
          variant="destructive"
          className={cn(
            "h-5 px-1.5 text-[10px]",
            collapsed ? "absolute right-1 top-1 h-4 min-w-4 px-1 text-[9px]" : "ml-auto",
          )}
        >
          {collapsed ? failedIndexCount : `F${failedIndexCount}`}
        </Badge>
      );
    }

    return null;
  };

  return (
      <nav aria-label="Navegación global" className={className}>
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed ? (
              <div className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {group.title}
              </div>
            ) : (
              <div className="mx-auto h-px w-8 bg-border/70" />
            )}

            {group.items.map((item) => {
              const Icon = item.icon;
              const isNovelEntry = item.to === "/novels";

              if (item.action === "visual_asset_library") {
                return (
                  <button
                    key={item.to}
                    type="button"
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex w-full items-center rounded-md text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                      collapsed ? "justify-center px-2 py-2.5" : "py-2 pl-4 pr-2",
                    )}
                    onClick={onOpenVisualAssets}
                  >
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", collapsed ? "mx-auto" : "mr-3")} />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </button>
                );
              }

              if (item.disabled) {
                return (
                  <div
                    key={item.to}
                    title={collapsed ? item.label : "Muy pronto"}
                    className={cn(
                      "relative flex cursor-not-allowed items-center rounded-md text-sm opacity-40",
                      collapsed ? "justify-center px-2 py-2.5" : "py-2 pl-4 pr-2",
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", collapsed ? "mx-auto" : "mr-3")} />
                    {!collapsed ? (
                      <span className="truncate">{item.label}</span>
                    ) : null}
                    {!collapsed ? (
                      <span className="ml-auto text-[10px] text-muted-foreground/60">Muy pronto</span>
                    ) : null}
                  </div>
                );
              }

              return (
                <NavLink key={item.to} to={item.to} title={collapsed ? item.label : undefined} onClick={onNavigate} className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  {({ isActive }) => (
                    <div
                      className={cn(
                        "relative flex items-center rounded-md text-sm transition-colors",
                        collapsed ? "justify-center px-2 py-2.5" : "py-2 pl-4 pr-2",
                        isActive
                          ? "bg-accent/90 font-semibold text-accent-foreground"
                          : "text-foreground hover:bg-accent hover:text-accent-foreground",
                        isNovelEntry && !collapsed && isActive && "ring-1 ring-primary/20",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-transparent",
                          isActive && "bg-primary",
                          collapsed && "left-0.5 h-6",
                        )}
                      />

                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          collapsed ? "mx-auto" : "mr-3",
                          isNovelEntry && "text-primary",
                        )}
                      />

                      {!collapsed ? (
                        <span className={cn("truncate", isNovelEntry && "font-semibold")}>
                          {item.label}
                        </span>
                      ) : null}

                      {renderBadge(item.to)}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
  );
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [visualAssetLibraryOpen, setVisualAssetLibraryOpen] = useState(false);
  return (
    <aside className={cn(
      "flex h-full min-h-0 flex-col border-r bg-muted/20 p-3 transition-[width] duration-200",
      collapsed ? "w-[72px]" : "w-64",
    )}>
      <div className={cn("mb-4 flex items-center", collapsed ? "justify-center" : "justify-end")}>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
          onClick={onToggle} aria-label={collapsed ? "Expandir la barra de navegación" : "Contraer barra de navegación"} title={collapsed ? "Expandir la barra de navegación" : "Contraer barra de navegación"}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <ProjectNavigation collapsed={collapsed} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1"
        onOpenVisualAssets={() => setVisualAssetLibraryOpen(true)} />
      <VisualAssetLibraryDialog open={visualAssetLibraryOpen} onOpenChange={setVisualAssetLibraryOpen} />
    </aside>
  );
}
