import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AntiAiRule } from "@ai-novel/shared/types/styleEngine";
import { FlaskConical, Plus, ShieldCheck } from "lucide-react";
import {
  createAntiAiRule,
  detectStyleIssues,
  generateAntiAiRuleDraft,
  getAntiAiRules,
  getEffectiveAntiAiRules,
  getStyleProfiles,
  rewriteStyleIssues,
  updateAntiAiRule,
} from "@/api/styleEngine";
import { queryKeys } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useLLMStore } from "@/store/llmStore";
import {
  RuleFilter,
  RuleFormState,
  buildEffectiveParamsKey,
  buildPayload,
  countTestRules,
  emptyForm,
  parsePatternText,
  ruleToForm,
} from "./antiAiRulesPage.shared";
import AntiAiEffectivePreviewCard from "./components/AntiAiEffectivePreviewCard";
import AntiAiRuleDialog from "./components/AntiAiRuleDialog";
import AntiAiRuleEffectTestCard from "./components/AntiAiRuleEffectTestCard";
import AntiAiRuleList from "./components/AntiAiRuleList";
import AntiAiRuleStats from "./components/AntiAiRuleStats";

export default function AntiAiRulesPage() {
  const queryClient = useQueryClient();
  const llm = useLLMStore();
  const [filter, setFilter] = useState<RuleFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AntiAiRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const [aiInstruction, setAiInstruction] = useState("");
  const [previewStyleProfileId, setPreviewStyleProfileId] = useState("");
  const [testingRuleIds, setTestingRuleIds] = useState<string[]>([]);
  const [testInput, setTestInput] = useState("");
  const [rewritePreview, setRewritePreview] = useState("");

  const rulesQuery = useQuery({
    queryKey: queryKeys.styleEngine.antiAiRules,
    queryFn: getAntiAiRules,
  });
  const profilesQuery = useQuery({
    queryKey: queryKeys.styleEngine.profiles,
    queryFn: getStyleProfiles,
  });
  const effectiveKey = buildEffectiveParamsKey(previewStyleProfileId);
  const effectiveQuery = useQuery({
    queryKey: queryKeys.styleEngine.effectiveAntiAiRules(effectiveKey),
    queryFn: () => getEffectiveAntiAiRules(previewStyleProfileId ? { styleProfileId: previewStyleProfileId } : undefined),
  });

  const rules = rulesQuery.data?.data ?? [];
  const profiles = profilesQuery.data?.data ?? [];
  const effective = effectiveQuery.data?.data;

  const stats = useMemo(() => ({
    total: rules.length,
    enabled: rules.filter((rule) => rule.enabled).length,
    global: rules.filter((rule) => rule.enabled && rule.globalBaselineEnabled).length,
    autoRewrite: rules.filter((rule) => rule.enabled && rule.autoRewrite).length,
  }), [rules]);

  const filteredRules = useMemo(() => {
    if (filter === "global") {
      return rules.filter((rule) => rule.enabled && rule.globalBaselineEnabled);
    }
    if (filter === "style") {
      return rules.filter((rule) => rule.enabled && !rule.globalBaselineEnabled);
    }
    if (filter === "disabled") {
      return rules.filter((rule) => !rule.enabled);
    }
    return rules;
  }, [filter, rules]);

  const testingRules = useMemo(
    () => testingRuleIds
      .map((ruleId) => rules.find((rule) => rule.id === ruleId))
      .filter((rule): rule is AntiAiRule => Boolean(rule)),
    [rules, testingRuleIds],
  );
  const testPreviewRuleIds = useMemo(() => {
    const ids = previewStyleProfileId
      ? testingRuleIds
      : [
        ...(effective?.globalBaselineRules.map((item) => item.rule.id) ?? []),
        ...testingRuleIds,
      ];
    return Array.from(new Set(ids));
  }, [effective?.globalBaselineRules, previewStyleProfileId, testingRuleIds]);

  const refreshRules = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.styleEngine.antiAiRules }),
      queryClient.invalidateQueries({ queryKey: ["style-engine", "anti-ai-rules", "effective"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.styleEngine.profiles }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) => createAntiAiRule(payload),
    onSuccess: async () => {
      await refreshRules();
      toast.success("Se crearon reglas anti-IA.");
      setDialogOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo crear la regla."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ReturnType<typeof buildPayload>> }) => updateAntiAiRule(id, payload),
    onSuccess: async () => {
      await refreshRules();
      toast.success("Se guardaron las reglas anti-IA.");
      setDialogOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudieron guardar las reglas."),
  });

  const aiDraftMutation = useMutation({
    mutationFn: () => generateAntiAiRuleDraft({
      mode: editingRule ? "improve" : "create",
      instruction: aiInstruction.trim(),
      currentRule: editingRule ? {
        key: form.key,
        name: form.name,
        type: form.type,
        severity: form.severity,
        description: form.description,
        detectPatterns: parsePatternText(form.detectPatternsText),
        promptInstruction: form.promptInstruction || null,
        rewriteSuggestion: form.rewriteSuggestion || null,
        enabled: form.enabled,
        globalBaselineEnabled: form.globalBaselineEnabled,
        autoRewrite: form.autoRewrite,
      } : undefined,
    }),
    onSuccess: (response) => {
      const result = response.data;
      if (!result) {
        toast.error("AI no devolvió borradores utilizables.");
        return;
      }
      setForm({
        key: result.draft.key,
        name: result.draft.name,
        type: result.draft.type,
        severity: result.draft.severity,
        description: result.draft.description,
        detectPatternsText: result.draft.detectPatterns.join("\n"),
        promptInstruction: result.draft.promptInstruction ?? "",
        rewriteSuggestion: result.draft.rewriteSuggestion ?? "",
        enabled: result.draft.enabled,
        globalBaselineEnabled: result.draft.globalBaselineEnabled,
        autoRewrite: result.draft.autoRewrite,
      });
      toast.success("Complete el formulario como borrador, verifíquelo y guárdelo.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "La IA no pudo generar borrador."),
  });

  const reviewScope = JSON.stringify([previewStyleProfileId, testPreviewRuleIds,
    profilesQuery.dataUpdatedAt, rulesQuery.dataUpdatedAt, effectiveQuery.dataUpdatedAt]);
  const detectionMutation = useMutation({
    mutationFn: async () => {
      const sourceContent = testInput;
      const sourceScope = reviewScope;
      const response = await detectStyleIssues({
        content: sourceContent,
        styleProfileId: previewStyleProfileId || undefined,
        previewAntiAiRuleIds: testPreviewRuleIds,
        provider: llm.provider,
        model: llm.model,
        temperature: 0.2,
      });
      return { ...response, sourceContent, sourceScope };
    },
    onSuccess: () => { setRewritePreview(""); rewriteMutation.reset(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "La detección falló."),
  });

  const rewriteMutation = useMutation({
    mutationFn: async () => {
      const sourceContent = testInput;
      const sourceScope = reviewScope;
      const response = await rewriteStyleIssues({
        content: sourceContent,
        styleProfileId: previewStyleProfileId || undefined,
        previewAntiAiRuleIds: testPreviewRuleIds,
        provider: llm.provider,
        model: llm.model,
        temperature: 0.5,
      });
      return { ...response, sourceContent, sourceScope };
    },
    onSuccess: (response) => setRewritePreview(response.data?.content ?? ""),
    onError: (error) => toast.error(error instanceof Error ? error.message : "La corrección falló."),
  });

  useEffect(() => {
    detectionMutation.reset();
    rewriteMutation.reset();
    setRewritePreview("");
  }, [previewStyleProfileId, testPreviewRuleIds.join("|")]);

  const currentDetection = detectionMutation.data?.sourceContent === testInput
    && detectionMutation.data.sourceScope === reviewScope ? detectionMutation.data.data : undefined;
  const currentRewrite = rewriteMutation.data?.sourceContent === testInput
    && rewriteMutation.data.sourceScope === reviewScope ? rewriteMutation.data.data : undefined;

  const openCreateDialog = () => {
    setEditingRule(null);
    setForm(emptyForm);
    setAiInstruction("");
    setDialogOpen(true);
  };

  const openEditDialog = (rule: AntiAiRule) => {
    setEditingRule(rule);
    setForm(ruleToForm(rule));
    setAiInstruction("");
    setDialogOpen(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payload = buildPayload(form);
    if (!payload.key || !payload.name || !payload.description) {
      toast.error("Complete el ID de la regla, el nombre y la descripción.");
      return;
    }
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const handleQuickToggle = (rule: AntiAiRule, field: "enabled" | "globalBaselineEnabled" | "autoRewrite", checked: boolean) => {
    updateMutation.mutate({ id: rule.id, payload: { [field]: checked } });
  };

  const toggleTestingRule = (ruleId: string) => {
    setTestingRuleIds((prev) => (
      prev.includes(ruleId) ? prev.filter((item) => item !== ruleId) : [...prev, ruleId]
    ));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const testScopeReady = Boolean(effective) && !effectiveQuery.isFetching && !effectiveQuery.isError
    && !rulesQuery.isFetching && !rulesQuery.isError && !isSaving;
  const testRuleCount = countTestRules(
    effective?.effectiveRules.map((item) => item.rule.id) ?? [],
    testingRules.map((rule) => rule.id),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-5 px-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
              <ShieldCheck aria-hidden="true" className="h-6 w-6 text-primary" />Reglas anti-IA
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Reducir la sensación de plantilla y conservar el tono de los personajes. Seleccione la regla de generación y pruebe el efecto con un fragmento de texto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><a href="#anti-ai-test-panel"><FlaskConical aria-hidden="true" className="h-4 w-4" />Prueba de efecto</a></Button>
            <Button type="button" onClick={openCreateDialog}><Plus aria-hidden="true" className="h-4 w-4" />Nueva regla</Button>
          </div>
        </div>
        {rulesQuery.isPending ? <p role="status" className="text-sm text-muted-foreground">Reglas de lectura...</p> : !rulesQuery.isError ? <AntiAiRuleStats {...stats} /> : null}
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <AntiAiRuleList
          rules={filteredRules}
          loading={rulesQuery.isLoading}
          error={rulesQuery.isError ? "Error al cargar la regla, vuelva a cargarla." : undefined}
          onRetry={() => { void rulesQuery.refetch(); }}
          filter={filter}
          isSaving={isSaving}
          testingRuleIds={testingRuleIds}
          onFilterChange={setFilter}
          onQuickToggle={handleQuickToggle}
          onEditRule={openEditDialog}
          onToggleTestingRule={toggleTestingRule}
        />

        <aside id="anti-ai-test-panel" aria-label="Pruebas efectivas de alcance y efecto de reglas" className="min-w-0 scroll-mt-6 divide-y divide-border/60 rounded-xl bg-card text-card-foreground">
          <AntiAiEffectivePreviewCard
            profiles={profiles}
            styleProfileId={previewStyleProfileId}
            effective={effective}
            loading={effectiveQuery.isFetching}
            error={effectiveQuery.isError ? "La carga de las reglas efectivas falló, vuelva a cargarlas y pruebe." : undefined}
            onRetry={() => { void effectiveQuery.refetch(); }}
            onStyleProfileChange={setPreviewStyleProfileId}
          />
          <AntiAiRuleEffectTestCard
            content={testInput}
            report={currentRewrite?.report ?? currentDetection ?? null}
            rewritePreview={currentRewrite ? rewritePreview : ""}
            rewriteGuard={currentRewrite?.rewriteGuard}
            detectionPending={detectionMutation.isPending}
            rewritePending={rewriteMutation.isPending}
            testRuleCount={testRuleCount}
            scopeReady={testScopeReady}
            previewRules={testingRules}
            onContentChange={setTestInput}
            onDetect={() => detectionMutation.mutate()}
            onRewrite={() => rewriteMutation.mutate()}
            onRemovePreviewRule={(ruleId) => setTestingRuleIds((prev) => prev.filter((item) => item !== ruleId))}
            onClearPreviewRules={() => setTestingRuleIds([])}
          />
        </aside>
      </div>

      <AntiAiRuleDialog
        open={dialogOpen}
        editingRule={editingRule}
        form={form}
        aiInstruction={aiInstruction}
        isSaving={isSaving}
        isAiDrafting={aiDraftMutation.isPending}
        onOpenChange={setDialogOpen}
        onFormChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onAiInstructionChange={setAiInstruction}
        onGenerateDraft={() => aiDraftMutation.mutate()}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
