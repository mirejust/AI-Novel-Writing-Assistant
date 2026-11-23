import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, Database, Search } from "lucide-react";
import type { EmbeddingProvider, RagEmbeddingModelStatus, RagProviderStatus } from "@/api/settings";
import SearchableSelect from "@/components/common/SearchableSelect";
import SelectField from "@/components/common/SelectField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface KnowledgeEmbeddingSettingsFormState {
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
  embeddingApiKey: string;
  embeddingBaseURL: string;
  collectionVersion: number;
  collectionMode: "auto" | "manual";
  collectionName: string;
  collectionTag: string;
  autoReindexOnChange: boolean;
  embeddingBatchSize: number;
  embeddingTimeoutMs: number;
  embeddingMaxRetries: number;
  embeddingRetryBaseMs: number;
  embeddingConcurrency: number;
  enabled: boolean;
  qdrantUrl: string;
  qdrantApiKey: string;
  qdrantApiKeyConfigured: boolean;
  clearQdrantApiKey: boolean;
  qdrantTimeoutMs: number;
  qdrantUpsertMaxBytes: number;
  qdrantUpsertConcurrency: number;
  chunkSize: number;
  chunkOverlap: number;
  vectorCandidates: number;
  keywordCandidates: number;
  finalTopK: number;
  workerPollMs: number;
  workerMaxAttempts: number;
  workerRetryBaseMs: number;
  httpTimeoutMs: number;
}

interface KnowledgeEmbeddingSettingsCardProps {
  form: KnowledgeEmbeddingSettingsFormState;
  setForm: Dispatch<SetStateAction<KnowledgeEmbeddingSettingsFormState>>;
  providers: RagProviderStatus[];
  modelOptions: string[];
  modelQuery: {
    isLoading: boolean;
    data?: RagEmbeddingModelStatus;
  };
  isSaving: boolean;
  onSave: () => void;
}

function slugifySegment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function buildSuggestedCollectionName(form: KnowledgeEmbeddingSettingsFormState): string {
  const parts = [
    "ai",
    "novel",
    "rag",
    form.embeddingProvider,
    slugifySegment(form.embeddingModel, "embedding"),
    slugifySegment(form.collectionTag, "kb"),
    `v${form.collectionVersion}`,
  ];
  return parts.join("_").slice(0, 120);
}

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function KnowledgeEmbeddingSettingsCard({
  form,
  setForm,
  providers,
  modelOptions,
  modelQuery,
  isSaving,
  onSave,
}: KnowledgeEmbeddingSettingsCardProps) {
  const suggestedCollectionName = useMemo(() => buildSuggestedCollectionName(form), [form]);
  const currentProvider = providers.find((item) => item.provider === form.embeddingProvider);
  const collectionNameToDisplay = form.collectionMode === "auto"
    ? suggestedCollectionName
    : form.collectionName.trim();

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary">
            <Search className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Deja que los datos participen en la creación.</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Seleccione un modelo vectorial y conéctese a la base de datos, y los datos indexados estarán disponibles para dividir libros, planificar y crear texto.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {currentProvider ? (
            <Badge variant="secondary" className="border-0 bg-muted/60 font-normal">{currentProvider.name}</Badge>
          ) : null}
          <Badge variant="secondary" className={`border-0 font-normal ${form.enabled ? "bg-success/10 text-success" : "bg-muted/60"}`}>
            {form.enabled ? "La recuperación de datos está habilitada." : "La recuperación de datos está en pausa"}
          </Badge>
        </div>
      </header>

      <div className="space-y-5">
        <section className="space-y-5 rounded-3xl bg-muted/20 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
              <Search className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="font-medium">Elige cómo entender los datos</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                Se recomienda utilizar un proveedor de servicios configurado y disponible; el modelo se utiliza para comprender el significado de los datos y no cambiará el texto original.
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <SelectField
                label="Proveedor de servicios de integración"
                value={form.embeddingProvider}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    embeddingProvider: value as EmbeddingProvider,
                    embeddingModel: "",
                  }))}
                options={providers.map((item) => ({
                  value: item.provider,
                  label: item.name,
                }))}
              />
              {currentProvider ? (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className={`border-0 font-normal ${currentProvider.isConfigured ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {currentProvider.isConfigured ? "Conexión configurada" : "Conexión a configurar"}
                  </Badge>
                  <Badge variant="secondary" className={`border-0 font-normal ${currentProvider.isActive ? "bg-success/10 text-success" : "bg-muted/60"}`}>
                    {currentProvider.isActive ? "Disponible" : "No habilitado"}
                  </Badge>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Modelo de incrustación</div>
              {modelQuery.isLoading ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Cargando modelos de incrustación disponibles...
                </div>
              ) : modelOptions.length > 0 ? (
                <SearchableSelect
                  value={form.embeddingModel}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, embeddingModel: value }))}
                  options={modelOptions.map((model) => ({ value: model }))}
                  placeholder="Seleccionar modelo de incrustación"
                  searchPlaceholder="Buscar modelos de incrustación"
                  emptyText="No hay ningún modelo de incrustación coincidente"
                />
              ) : null}
              <Input
                className={modelQuery.isLoading || modelOptions.length > 0 ? "hidden" : undefined}
                value={form.embeddingModel}
                onChange={(event) => setForm((prev) => ({ ...prev, embeddingModel: event.target.value }))}
                placeholder="Por ejemplo: incrustación de texto-3-pequeño"
              />
              {modelQuery.data ? (
                <div className="text-xs text-muted-foreground">
                  {modelQuery.data.source === "remote"
                    ? `Modelos disponibles para proveedores de servicios:${modelQuery.data.models.length} individual.`
                    : "Puedes utilizar el modelo recomendado primero; cuando la configuración de conexión esté disponible, la lista mostrará el modelo del proveedor de servicios."}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Clave API de servicio vectorial</div>
              <Input
                type="password"
                value={form.embeddingApiKey}
                onChange={(event) => setForm((prev) => ({ ...prev, embeddingApiKey: event.target.value }))}
                placeholder={currentProvider?.isConfigured ? "Déjelo en blanco para conservar la clave guardada." : "Ingrese la clave API del servicio vectorial"}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Dirección API del servicio vectorial</div>
              <Input
                value={form.embeddingBaseURL}
                onChange={(event) => setForm((prev) => ({ ...prev, embeddingBaseURL: event.target.value }))}
                placeholder="Déjelo en blanco para utilizar la dirección predeterminada del proveedor de servicios."
              />
            </div>
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            La conexión aquí es solo para la comprensión de los datos y no cambiará el modelo de creación, el modelo predeterminado ni el enrutamiento de tareas.
          </div>

        </section>

        <section className="space-y-5 rounded-3xl border border-border/35 bg-card/70 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
              <Database className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="font-medium">Conectarse a la base de datos</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                Admite Qdrant Cloud, Qdrant autohospedado o repositorios nativos.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">URL de la biblioteca de vectores</div>
            <Input
              value={form.qdrantUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, qdrantUrl: event.target.value }))}
              placeholder="http://127.0.0.1:6333"
            />
            <div className="text-xs text-muted-foreground">
              La dirección predeterminada de la máquina local suele ser http://127.0.0.1:6333; la dirección de la nube puede completar directamente la URL completa.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Clave API de biblioteca vectorial</div>
                <Badge variant="secondary" className={`border-0 font-normal ${form.qdrantApiKeyConfigured ? "bg-success/10 text-success" : "bg-muted/60"}`}>
                  {form.qdrantApiKeyConfigured ? "Clave disponible" : "Sin configurar"}
                </Badge>
              </div>
              <Input
                type="password"
                value={form.qdrantApiKey}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    qdrantApiKey: event.target.value,
                    clearQdrantApiKey: false,
                  }))}
                placeholder={form.qdrantApiKeyConfigured ? "Déjelo en blanco para conservar la clave guardada." : "Ingrese la clave API de la biblioteca de vectores"}
              />
            </div>

            <label className="flex items-center gap-2 rounded-2xl bg-muted/25 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={form.clearQdrantApiKey}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    clearQdrantApiKey: event.target.checked,
                    qdrantApiKey: event.target.checked ? "" : prev.qdrantApiKey,
                  }))}
              />
              Borrar la clave API de la biblioteca de vectores guardada al guardar
            </label>
          </div>
        </section>

        <details className="group rounded-3xl bg-muted/20 p-5 sm:p-6">
          <summary className="flex cursor-pointer list-none flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="font-medium">Configuración avanzada</div>
              <div className="text-xs text-muted-foreground">
                Versión de colección v{form.collectionVersion} · Denominación de colecciones, reconstrucción de índices, calidad de búsqueda y parámetros de tareas en segundo plano
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="group-open:hidden">Expandir</span>
              <span className="hidden group-open:inline">Cerca</span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
            </div>
          </summary>

          <div className="mt-5 space-y-6">
            <section className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Colecciones e índices</div>
                <div className="text-xs text-muted-foreground">
                  La denominación automática distingue las colecciones por proveedor de servicios, modelo, etiqueta y versión, lo que reduce el riesgo de conflictos de dimensiones vectoriales.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Método de nomenclatura de colección"
                  value={form.collectionMode}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      collectionMode: value as "auto" | "manual",
                    }))}
                  options={[
                    { value: "auto", label: "Generado automáticamente" },
                    { value: "manual", label: "Especificar manualmente" },
                  ]}
                />

                <div className="space-y-2">
                  <div className="text-sm font-medium">Etiquetas de colección</div>
                  <Input
                    value={form.collectionTag}
                    onChange={(event) => setForm((prev) => ({ ...prev, collectionTag: event.target.value }))}
                    placeholder="Por ejemplo: kb/prod/novela"
                  />
                  <div className="text-xs text-muted-foreground">
                    Utilice una etiqueta corta para distinguir entornos o diferentes agrupaciones de datos.
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">
                  {form.collectionMode === "auto" ? "Generar automáticamente nombres de colecciones" : "Nombre de la colección de la biblioteca vectorial"}
                </div>
                {form.collectionMode === "auto" ? (
                  <div className="rounded-md border border-dashed bg-muted/20 p-3 font-mono text-xs break-all">
                    {collectionNameToDisplay}
                  </div>
                ) : (
                  <Input
                    value={form.collectionName}
                    onChange={(event) => setForm((prev) => ({ ...prev, collectionName: event.target.value }))}
                    placeholder="Por ejemplo: ai_novel_rag_openai_text_embedding_3_small_kb_v1"
                  />
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Reconstruir automáticamente el índice después de los cambios de incrustación"
                  value={form.autoReindexOnChange ? "true" : "false"}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      autoReindexOnChange: value === "true",
                    }))}
                  options={[
                    { value: "true", label: "Encender" },
                    { value: "false", label: "Cerrar" },
                  ]}
                />

                <div className="rounded-md border bg-background p-3">
                  <div className="text-sm font-medium">Conjunto de objetivos</div>
                  <div className="mt-2 font-mono text-xs break-all">{collectionNameToDisplay}</div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Parámetros de conexión y escritura.</div>
                <div className="text-xs text-muted-foreground">
                  El valor predeterminado es adecuado para la mayoría de las bases de conocimiento; ajústelo solo si la conexión es lenta, las escrituras por lotes fallan o es necesario pausar la recuperación.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <SelectField
                  label="Estado del RAG"
                  value={form.enabled ? "true" : "false"}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      enabled: value === "true",
                    }))}
                  options={[
                    { value: "true", label: "Habilitar" },
                    { value: "false", label: "Pausar" },
                  ]}
                />

                <div className="space-y-2">
                  <div className="text-sm font-medium">Tiempo de espera de la biblioteca de vectores (milisegundos)</div>
                  <Input
                    type="number"
                    min={1000}
                    max={300000}
                    value={form.qdrantTimeoutMs}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        qdrantTimeoutMs: parseNumberInput(event.target.value, prev.qdrantTimeoutMs),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Número máximo de bytes escritos a la vez</div>
                  <Input
                    type="number"
                    min={1024 * 1024}
                    max={64 * 1024 * 1024}
                    value={form.qdrantUpsertMaxBytes}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        qdrantUpsertMaxBytes: parseNumberInput(event.target.value, prev.qdrantUpsertMaxBytes),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Número de escrituras simultáneas en la biblioteca de vectores</div>
                  <Input
                    type="number"
                    min={1}
                    max={16}
                    value={form.qdrantUpsertConcurrency}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        qdrantUpsertConcurrency: parseNumberInput(event.target.value, prev.qdrantUpsertConcurrency),
                      }))}
                  />
                  <div className="text-xs text-muted-foreground">
                    El número máximo de envíos simultáneos de lotes fragmentados a Qdrant. El valor predeterminado es 3, los documentos grandes se pueden ajustar a 4-6 para acelerar.
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Ajuste de recuperación</div>
                <div className="text-xs text-muted-foreground">
                  Cuando el contenido recuperado no es lo suficientemente preciso o es necesario controlar el retraso de recuperación, se puede ajustar el número de bloques y candidatos.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Tamaño de corte</div>
                  <Input
                    type="number"
                    min={200}
                    max={4000}
                    value={form.chunkSize}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        chunkSize: parseNumberInput(event.target.value, prev.chunkSize),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Rebanadas superpuestas</div>
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    value={form.chunkOverlap}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        chunkOverlap: parseNumberInput(event.target.value, prev.chunkOverlap),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Top K final</div>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.finalTopK}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        finalTopK: parseNumberInput(event.target.value, prev.finalTopK),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Número de candidatos a vectores</div>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={form.vectorCandidates}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        vectorCandidates: parseNumberInput(event.target.value, prev.vectorCandidates),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Número de candidatos de palabras clave</div>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={form.keywordCandidates}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        keywordCandidates: parseNumberInput(event.target.value, prev.keywordCandidates),
                      }))}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Comportamiento de solicitud de incrustación</div>
                <div className="text-xs text-muted-foreground">
                  Los parámetros de tamaño de lote, tiempo de espera, reintento y sondeo se pueden ajustar al importar en lotes grandes o cuando el servicio tarda en responder.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Tamaño del lote de incrustación</div>
                  <Input
                    type="number"
                    min={1}
                    max={256}
                    value={form.embeddingBatchSize}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        embeddingBatchSize: parseNumberInput(event.target.value, prev.embeddingBatchSize),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Incrustar número de simultaneidad</div>
                  <Input
                    type="number"
                    min={1}
                    max={16}
                    value={form.embeddingConcurrency}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        embeddingConcurrency: parseNumberInput(event.target.value, prev.embeddingConcurrency),
                      }))}
                  />
                  <div className="text-xs text-muted-foreground">
                    El número de solicitudes de API de incorporación iniciadas simultáneamente. El valor predeterminado es 4; aumentarlo puede acortar significativamente el tiempo de indexación de documentos grandes, pero depende de la cuota del proveedor de servicios.
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Tiempo de espera de incrustación (milisegundos)</div>
                  <Input
                    type="number"
                    min={5000}
                    max={300000}
                    value={form.embeddingTimeoutMs}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        embeddingTimeoutMs: parseNumberInput(event.target.value, prev.embeddingTimeoutMs),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Incrustar el máximo de reintentos</div>
                  <Input
                    type="number"
                    min={0}
                    max={8}
                    value={form.embeddingMaxRetries}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        embeddingMaxRetries: parseNumberInput(event.target.value, prev.embeddingMaxRetries),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Intervalo base de reintento de incrustación (milisegundos)</div>
                  <Input
                    type="number"
                    min={100}
                    max={10000}
                    value={form.embeddingRetryBaseMs}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        embeddingRetryBaseMs: parseNumberInput(event.target.value, prev.embeddingRetryBaseMs),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Intervalo de sondeo del trabajador (milisegundos)</div>
                  <Input
                    type="number"
                    min={200}
                    max={60000}
                    value={form.workerPollMs}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        workerPollMs: parseNumberInput(event.target.value, prev.workerPollMs),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Número máximo de intentos del trabajador</div>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={form.workerMaxAttempts}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        workerMaxAttempts: parseNumberInput(event.target.value, prev.workerMaxAttempts),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Intervalo base de reintento del trabajador (milisegundos)</div>
                  <Input
                    type="number"
                    min={1000}
                    max={300000}
                    value={form.workerRetryBaseMs}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        workerRetryBaseMs: parseNumberInput(event.target.value, prev.workerRetryBaseMs),
                      }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Tiempo de espera de HTTP RAG (milisegundos)</div>
                  <Input
                    type="number"
                    min={1000}
                    max={300000}
                    value={form.httpTimeoutMs}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        httpTimeoutMs: parseNumberInput(event.target.value, prev.httpTimeoutMs),
                      }))}
                  />
                </div>
              </div>
            </section>
          </div>
        </details>

        <div className="flex flex-col gap-3 border-t border-border/30 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">Después de guardar, los datos nuevos o reindexados utilizarán este conjunto de configuraciones de búsqueda.</p>
          <Button
            className="w-full rounded-full sm:w-auto"
            onClick={onSave}
            disabled={
              isSaving
              || modelQuery.isLoading
              || !form.embeddingModel.trim()
              || !collectionNameToDisplay.trim()
              || !form.qdrantUrl.trim()
            }
          >
            {isSaving ? "Guardando..." : "Guardar configuración de búsqueda"}
          </Button>
        </div>
      </div>
    </section>
  );
}
