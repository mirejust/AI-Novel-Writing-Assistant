import {useId, useState, type ReactNode} from "react";
import {ArrowRight, BookOpenText, ListTree, Settings2} from "lucide-react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {directorChapterTokenLimitSchema, MAX_DIRECTOR_CHAPTER_TOKEN_LIMIT} from "@ai-novel/shared/types/director/chapterBudget";
import {getDirectorChapterBudgetSettings} from "@/api/settings";
import LLMSelector from "@/components/common/LLMSelector";
import {useLLMStore} from "@/store/llmStore";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {createDirectorCommandKey,submitDirectorCommand,type DirectorDriver} from "@/api/directorNext";
import {queryKeys} from "@/api/queryKeys";
import PanelDisclosure from "./panel/PanelDisclosure";
import "./panel/directorStart.css";

function StartField({label, qualifier, children}: {label: string; qualifier?: string; children: ReactNode}) {
  return (
    <label className="grid min-w-0 content-start gap-2">
      <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium leading-5 text-foreground">
        {label}{qualifier && <span className="text-xs font-normal text-muted-foreground">{qualifier}</span>}
      </span>
      {children}
    </label>
  );
}

export default function DirectorStart({novelId, estimatedChapterCount, nextChapter, initialStory, worldId, suggestedRange, initialDriver = "assisted"}: {
  novelId: string; estimatedChapterCount: number | null; nextChapter: number; initialStory: string; worldId?: string | null;
  suggestedRange?: {from:number;to:number}|null;
  initialDriver?: DirectorDriver;
}) {
  const [story, setStory] = useState(initialStory), [count,setCount] = useState(Math.max(estimatedChapterCount ?? 30, nextChapter));
  const [production,setProduction] = useState(Boolean(suggestedRange)), [from,setFrom] = useState(suggestedRange?.from ?? nextChapter), [to,setTo] = useState(suggestedRange?.to ?? nextChapter);
  const [assisted,setAssisted] = useState(initialDriver === "assisted");
  const scopeId = useId();
  const [issuePolicyMode, setIssuePolicyMode] = useState<"inherit" | "quality_first" | "completion_first">("inherit");
  const [world,setWorld] = useState<"skip"|"reuse"|"generate">(worldId ? "reuse" : "skip");
  const model = useLLMStore(), queries = useQueryClient();
  const [chapterBudget, setChapterBudget] = useState("");
  const [volumeCount, setVolumeCount] = useState("");
  const validVolumeCount = !volumeCount || (Number.isInteger(Number(volumeCount)) && Number(volumeCount) >= 1 && Number(volumeCount) <= 24);
  const budgetSettings = useQuery({queryKey: queryKeys.settings.directorChapterBudget, queryFn: getDirectorChapterBudgetSettings});
  const validBudget = !chapterBudget.trim() || directorChapterTokenLimitSchema.safeParse(Number(chapterBudget)).success;
  const mutation = useMutation({mutationFn: async () => {
    if (!story.trim() || !model.provider || !model.model || !Number.isInteger(count) || count < 1) throw new Error("Complete la dirección de la historia, el número objetivo de capítulos y seleccione un modelo.");
    if (production && (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > count)) throw new Error("Complete el rango de capítulos válido dentro del número objetivo de capítulos.");
    if (!validVolumeCount) throw new Error("El número de lista fijo debe ser un número entero entre 1 y 24, o dejarse en blanco para que AI lo recomiende.");
    if (!validBudget) throw new Error("El límite superior de uso de IA en un solo capítulo debe ser un número entero entre 16.001 y 10.000.000.");
    return submitDirectorCommand({type:"open_run",novelId,driver:assisted ? "assisted" : "auto",stepIdsInScope:null,idempotencyKey:createDirectorCommandKey(),
      launchInput:{storyInput:story.trim(),estimatedChapterCount:count,...(volumeCount ? {userPreferredVolumeCount:Number(volumeCount)} : {}),worldMode:world,targetMode:"opening",provider:model.provider,model:model.model,temperature:model.temperature,
        issuePolicyMode: issuePolicyMode === "inherit" ? undefined : issuePolicyMode,...(chapterBudget.trim() ? {chapterTokenLimit:Number(chapterBudget)} : {}),...(production ? {executionRange:{from,to}} : {})}});
  },onSuccess: async()=>{await Promise.all([queries.invalidateQueries({queryKey:queryKeys.directorNext.summary(novelId)}),queries.invalidateQueries({queryKey:queryKeys.directorNext.detail(novelId)})]);}});
  return <section id="director-start" className="grid min-w-0 gap-5">
    <div className="grid min-w-0 gap-3">
      <h2 className="text-lg font-semibold leading-snug">Próxima creación</h2>
      <fieldset className="grid min-w-0 grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <legend className="sr-only">Elige contenido creativo</legend>
        {[{label: "Escribir el texto del capítulo", writeChapters: true, icon: BookOpenText}, {label: "Solo planifica", writeChapters: false, icon: ListTree}].map(({label, writeChapters, icon: Icon}) =>
          <label key={label} className="min-w-0 cursor-pointer">
            <input type="radio" className="peer sr-only" name={scopeId} checked={production === writeChapters} onChange={()=>setProduction(writeChapters)} />
            <span className="flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground peer-checked:bg-background peer-checked:font-semibold peer-checked:text-foreground peer-checked:ring-1 peer-checked:ring-inset peer-checked:ring-border peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              <Icon className="size-4 shrink-0" aria-hidden="true"/>{label}
            </span>
          </label>
        )}
      </fieldset>
      <p className="text-sm leading-6 text-muted-foreground">{production ? "AI completará el plan y continuará escribiendo los capítulos seleccionados. Se conservará el texto existente." : "La IA completará la planificación creativa de este libro y se conservará el texto existente."}</p>
    </div>
    {production && <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
      <StartField label="Capítulo inicial"><Input className="director-start-control tabular-nums" type="number" min={1} max={count} value={from} onChange={e=>setFrom(Number(e.target.value))}/></StartField>
      <ArrowRight className="mb-3 size-4 text-muted-foreground" aria-hidden="true" />
      <StartField label="Fin del capitulo"><Input className="director-start-control tabular-nums" type="number" min={from} max={count} value={to} onChange={e=>setTo(Number(e.target.value))}/></StartField>
    </div>}
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="grid gap-1 text-sm font-medium">Confirmar resultados por etapa<span className="text-xs font-normal leading-5 text-muted-foreground">{assisted ? "Cada etapa es confirmada por usted antes de continuar." : "La IA avanzará automáticamente según este rango."}</span></span>
      <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={assisted} onChange={e=>setAssisted(e.target.checked)}/>
    </label>
    <div className="border-y border-border/60">
      <PanelDisclosure title="Configuraciones más creativas" icon={Settings2} value={model.model || "Seleccionar modelo"}>
        <div className="director-start-settings grid min-w-0 gap-6 rounded-xl bg-muted/50 py-5">
          <section className="grid min-w-0 gap-4">
            <h3 className="text-base font-semibold leading-6">Configuración del libro</h3>
            <StartField label="Dirección de la historia">
              <textarea className="director-start-control min-h-32 resize-y py-2.5 leading-6" rows={5}
                value={story} onChange={e=>setStory(e.target.value)} placeholder="¿De qué trata este libro y qué quiere lograr el protagonista?" />
            </StartField>
            <div className="director-start-pair">
              <StartField label="Número objetivo de capítulos del libro">
                <Input className="director-start-control tabular-nums" type="number" min={1} value={count} onChange={e=>setCount(Number(e.target.value))}/>
              </StartField>
              <div className="grid min-w-0 gap-2">
                <StartField label="Número fijo de rollos." qualifier="Opcional">
                  <Input className="director-start-control tabular-nums" type="number" min={1} max={24} step={1} value={volumeCount}
                    placeholder="Dejar en blanco para ser recomendado por AI" aria-invalid={!validVolumeCount} aria-describedby={`${scopeId}-volumes`} onChange={event=>setVolumeCount(event.target.value)}/>
                </StartField>
                <p id={`${scopeId}-volumes`} className={validVolumeCount ? "director-start-hint" : "text-xs leading-5 text-destructive"}>
                  {validVolumeCount ? "Se pueden especificar los volúmenes 1 a 24 y se conservarán las estructuras de volúmenes existentes." : "Ingrese un número entero entre 1 y 24 o déjelo en blanco para obtener una recomendación de IA."}
                </p>
              </div>
            </div>
            <StartField label="Ambientación del mundo">
              <select className="director-start-control" value={world} onChange={e=>setWorld(e.target.value as typeof world)}>
                <option value="skip">No usar configuraciones mundiales independientes</option>
                {worldId ? <option value="reuse">Utilice este libro para conectarse con el mundo.</option> : null}
                <option value="generate">Configuración mundial lista para IA</option>
              </select>
            </StartField>
          </section>
          <section className="grid min-w-0 gap-4 border-t border-border pt-5">
            <h3 className="text-base font-semibold leading-6">Opciones de construcción</h3>
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium leading-5">Modelo de escritura</legend>
              <LLMSelector compact showBadge={false} className="director-start-model" />
            </fieldset>
            <div className="grid gap-2">
              <StartField label="Límite de uso de IA de un solo capítulo" qualifier="Tokens">
                <Input className="director-start-control tabular-nums" type="number" min={16001} max={MAX_DIRECTOR_CHAPTER_TOKEN_LIMIT} step={1}
                  value={chapterBudget} placeholder={budgetSettings.data?.data ? `Heredar configuración global:${budgetSettings.data.data.tokenLimit.toLocaleString("zh-CN")}` : "Déjelo en blanco para heredar la configuración global"}
                  aria-invalid={!validBudget} aria-describedby={`${scopeId}-budget`} onChange={event=>setChapterBudget(event.target.value)}/>
              </StartField>
              <p id={`${scopeId}-budget`} className={validBudget ? "director-start-hint" : "text-xs leading-5 text-destructive"}>
                {validBudget ? "Cuando se utiliza la cuota predeterminada del sistema, cada capítulo se puede agregar automáticamente una vez según sea necesario. Cuando utilice una cuota global personalizada o guardada, se le pedirá que confirme antes de agregarla." : "Introduzca un número entero entre 16.001 y 10.000.000, o déjelo en blanco para heredar la configuración global."}
              </p>
            </div>
            <StartField label="Este tratamiento de calidad">
              <select className="director-start-control" value={issuePolicyMode} onChange={event => setIssuePolicyMode(event.target.value as typeof issuePolicyMode)}>
                <option value="inherit">Utilice este libro para la gestión de problemas.</option>
                <option value="quality_first">Los problemas de calidad necesitan mi confirmación.</option>
                <option value="completion_first">Grabar recordatorio y continuar</option>
              </select>
            </StartField>
          </section>
        </div>
      </PanelDisclosure>
    </div>
    <Button className="h-auto min-h-11 w-full gap-2 whitespace-normal rounded-lg font-semibold" disabled={mutation.isPending || !validBudget || !validVolumeCount} onClick={()=>mutation.mutate()}>
      {mutation.isPending ? "Enviando…" : production ? `Presentar y generar el ${from}—${to}` : "Enviar y completar el plan creativo."}
      {!mutation.isPending && <ArrowRight className="size-4 shrink-0" aria-hidden="true" />}
    </Button>
    {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
  </section>;
}
