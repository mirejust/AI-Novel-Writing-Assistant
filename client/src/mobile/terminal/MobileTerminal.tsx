import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MobileShelf } from "./MobileShelf";
import { MobileNovel } from "./MobileNovel";
import { MobileRecords, MobileNotifications } from "./MobileRecords";
import { resolveMobileTerminalRoute } from "./routePolicy";

export function MobileTerminal() {
  const location = useLocation();
  const route = resolveMobileTerminalRoute(location.pathname);
  const active = route.kind === "novel" ? "shelf" : route.kind;
  const tabs = [{ kind: "shelf", to: "/novels", label: "Novela" }, { kind: "records", to: "/tasks", label: "Registro de operación" }, { kind: "notifications", to: "/auto-director/follow-ups", label: "Notificar" }];
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="border-b px-4 py-4"><Link to="/novels" className="font-semibold">Nuevo banco de trabajo rápido</Link></header>
    <main className="mobile-site-main mx-auto max-w-xl space-y-5 px-4 py-5 pb-28">
      {route.kind === "shelf" ? <MobileShelf /> : route.kind === "records" ? <MobileRecords /> : route.kind === "notifications" ? <MobileNotifications /> : route.kind === "novel" ? <MobileNovel key={route.novelId} novelId={route.novelId} chapterId={route.chapterId} /> : <section className="space-y-4"><h1 className="text-xl font-semibold">Por favor abra esta herramienta en su computadora</h1><p className="text-sm text-muted-foreground">La importación de manuscritos y la revisión de la estructura, la configuración del modelo, la planificación del mundo y los personajes, la edición de esquemas, los cómics, la exportación y la gestión de datos deben completarse en la computadora. En el teléfono móvil se puede consultar el avance de la novela, leer y modificar el texto y dar seguimiento a las tareas.</p><Button asChild><Link to="/novels">Ver novela</Link></Button></section>}
    </main>
    <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{tabs.map(tab => <Link key={tab.kind} to={tab.to} aria-current={active === tab.kind ? "page" : undefined} className={`rounded-md px-4 py-2 text-sm ${active === tab.kind ? "bg-muted font-semibold text-primary" : "text-muted-foreground"}`}>{tab.label}</Link>)}</nav>
  </div>;
}
