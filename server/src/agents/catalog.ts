import type { AgentCatalog, AgentCatalogAgent } from "@ai-novel/shared/types/agent";
import { getPermissionMatrixSummary } from "./approvalPolicy";
import { listAgentToolDefinitions } from "./toolRegistry";

const DOMAIN_AGENTS: AgentCatalogAgent[] = [
  {
    name: "Coordinator",
    title: "control creativo",
    description: "Responsable de la planificación entre módulos, resumen de estado, diagnóstico de tareas y orquestación de acciones.",
    resourceScopes: ["global", "task", "agent_run", "generation_job"],
  },
  {
    name: "NovelAgent",
    title: "centro novedoso",
    description: "Responsable de novelas, capítulos, instantáneas, decisiones creativas y enlaces de generación de capítulos.",
    resourceScopes: ["novel", "chapter", "creative_decision", "snapshot", "generation_job"],
  },
  {
    name: "BookAnalysisAgent",
    title: "Analista de última hora",
    description: "Responsable de las tareas de apertura de libros, resultados de análisis y acumulación de conocimientos.",
    resourceScopes: ["book_analysis", "knowledge_document", "task"],
  },
  {
    name: "KnowledgeAgent",
    title: "Archivero del conocimiento",
    description: "Responsable de los documentos de conocimiento, el estado del índice, los diagnósticos de recuperación y las relaciones vinculantes.",
    resourceScopes: ["knowledge_document", "task"],
  },
  {
    name: "WorldAgent",
    title: "editor de cosmovisión",
    description: "Responsable del estado de la cosmovisión, diagnóstico de conflictos, instantáneas y encuadernación de novelas.",
    resourceScopes: ["world", "snapshot", "novel"],
  },
  {
    name: "FormulaAgent",
    title: "editor de fórmulas",
    description: "Responsable del manejo, adaptación e interpretación de fórmulas de escritura y precipitación de estilo.",
    resourceScopes: ["writing_formula", "novel", "chapter"],
  },
  {
    name: "CharacterAgent",
    title: "Archivista de funciones",
    description: "Responsable de la biblioteca de roles básicos, la reutilización de plantillas y el contexto de roles.",
    resourceScopes: ["base_character", "novel", "chapter"],
  },
];

function inferUiKind(toolName: string): string {
  if (toolName === "create_novel" || toolName === "select_novel_workspace") {
    return "workspace_action";
  }
  if (toolName.startsWith("generate_") || toolName === "sync_chapters_from_structured_outline" || toolName === "get_novel_production_status") {
    return "production_stage";
  }
  if (toolName.includes("failure") || toolName.includes("blocker") || toolName.includes("conflict")) {
    return "diagnostic_card";
  }
  if (toolName.startsWith("list_")) {
    return "resource_list";
  }
  if (toolName.includes("chapter_content") || toolName.includes("summarize")) {
    return "chapter_reader";
  }
  if (toolName.includes("preview") || toolName.includes("queue") || toolName.includes("retry")) {
    return "task_action";
  }
  return "default";
}

function inferFollowupActions(toolName: string): string[] {
  if (toolName === "create_novel") {
    return ["Continuar mejorando la configuración", "Vincular el espacio de trabajo actual", "Comience a crear un capítulo"];
  }
  if (toolName === "generate_world_for_novel") {
    return ["Continuar generando personajes", "Ver visión del mundo", "Compruebe si hay conflictos de cosmovisión"];
  }
  if (toolName === "generate_novel_characters") {
    return ["Continuar generando la Biblia", "Ver el estado del personaje", "Continuar generando el libro completo."];
  }
  if (toolName === "generate_story_bible" || toolName === "generate_novel_outline" || toolName === "generate_structured_outline") {
    return ["Continuar generando el libro completo.", "Consulta todo el estado de producción.", "Verifique la preparación actual de los activos"];
  }
  if (toolName === "get_novel_production_status") {
    return ["Continuar generando la novela actual.", "¿Por qué no se inicia toda la compilación?", "Ver la tabla de contenidos del capítulo actual"];
  }
  if (toolName === "select_novel_workspace") {
    return ["Continuar trabajando en torno a la novela.", "Ver capítulo", "iniciar la escritura"];
  }
  if (toolName.includes("failure") || toolName.includes("blocker")) {
    return ["Ver tareas relacionadas", "Continúe preguntando por qué ocurrió la falla.", "Intentar otra vez"];
  }
  if (toolName.startsWith("list_")) {
    return ["Filtrar resultados", "Continuar en el centro creativo", "Abra el módulo correspondiente"];
  }
  if (toolName.includes("chapter")) {
    return ["Continuar resumiendo", "Iniciar reescritura", "Compruebe si hay conflictos"];
  }
  return ["sigue preguntando", "Abra el módulo correspondiente"];
}

export function buildAgentCatalog(): AgentCatalog {
  return {
    agents: DOMAIN_AGENTS,
    tools: listAgentToolDefinitions().map((tool) => ({
      ...tool,
      uiKind: inferUiKind(tool.name),
      followupActions: inferFollowupActions(tool.name),
    })),
    approvalPolicySummary: getPermissionMatrixSummary()
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}
