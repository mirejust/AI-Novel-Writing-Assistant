import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { DirectorWorkspaceAnalysis } from "@ai-novel/shared/types/directorRuntime";
import type { DirectorRuntimeService } from "../runtime/DirectorRuntimeService";
import type { WorkflowPlan, WorkflowPlanStep } from "../workflowStepRuntime/WorkflowStepModule";

export type DirectorLangGraphPilotStatus = "completed" | "interrupted" | "failed";

export interface DirectorLangGraphPilotTraceEvent {
  node: "workspace_analyze" | "recommend_next_action" | "run_next_step" | "approval_interrupt";
  status: "completed" | "skipped" | "interrupted" | "failed";
  stepId?: string | null;
  summary: string;
}

export interface DirectorLangGraphPilotInterrupt {
  id: string;
  stepId: string;
  title: string;
  summary: string;
  resumable: true;
}

export interface DirectorLangGraphPilotCheckpoint {
  completedGraphNodes: string[];
  completedStepIds: string[];
  pendingStep?: WorkflowPlanStep | null;
  interrupt?: DirectorLangGraphPilotInterrupt | null;
  trace: DirectorLangGraphPilotTraceEvent[];
}

export interface DirectorLangGraphPilotInput {
  taskId: string;
  novelId?: string | null;
  plan: WorkflowPlan;
  checkpoint?: DirectorLangGraphPilotCheckpoint | null;
  interruptBeforeStepIds?: string[];
  resume?: {
    interruptId: string;
    approved: boolean;
  } | null;
}

export interface DirectorLangGraphPilotResult {
  status: DirectorLangGraphPilotStatus;
  nextStep?: WorkflowPlanStep | null;
  executedStepIds: string[];
  interrupt?: DirectorLangGraphPilotInterrupt | null;
  checkpoint: DirectorLangGraphPilotCheckpoint;
  trace: DirectorLangGraphPilotTraceEvent[];
}

interface DirectorLangGraphPilotDeps {
  directorRuntime: Pick<DirectorRuntimeService, "analyzeWorkspace">;
  runStep?: (input: {
    taskId: string;
    novelId?: string | null;
    plan: WorkflowPlan;
    step: WorkflowPlanStep;
  }) => Promise<void>;
}

const DirectorLangGraphPilotState = Annotation.Root({
  taskId: Annotation<string>(),
  novelId: Annotation<string | null>(),
  plan: Annotation<WorkflowPlan>(),
  checkpoint: Annotation<DirectorLangGraphPilotCheckpoint | null>(),
  interruptBeforeStepIds: Annotation<string[]>(),
  resume: Annotation<DirectorLangGraphPilotInput["resume"]>(),
  completedGraphNodes: Annotation<string[]>(),
  completedStepIds: Annotation<string[]>(),
  pendingStep: Annotation<WorkflowPlanStep | null>(),
  analysis: Annotation<DirectorWorkspaceAnalysis | null>(),
  interrupt: Annotation<DirectorLangGraphPilotInterrupt | null>(),
  status: Annotation<DirectorLangGraphPilotStatus>(),
  executedStepIds: Annotation<string[]>(),
  trace: Annotation<DirectorLangGraphPilotTraceEvent[]>(),
});

type DirectorLangGraphPilotStateValue = typeof DirectorLangGraphPilotState.State;

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function appendTrace(
  state: DirectorLangGraphPilotStateValue,
  event: DirectorLangGraphPilotTraceEvent,
): DirectorLangGraphPilotTraceEvent[] {
  return [...(state.trace ?? []), event];
}

function hasCompletedGraphNode(state: DirectorLangGraphPilotStateValue, node: string): boolean {
  return (state.completedGraphNodes ?? []).includes(node);
}

function addCompletedGraphNode(state: DirectorLangGraphPilotStateValue, node: string): string[] {
  return unique([...(state.completedGraphNodes ?? []), node]);
}

function createInterrupt(input: {
  taskId: string;
  step: WorkflowPlanStep;
}): DirectorLangGraphPilotInterrupt {
  return {
    id: `${input.taskId}:${input.step.stepId}:approval`,
    stepId: input.step.stepId,
    title: "Esperando confirmación del siguiente paso",
    summary: `Continuar la ejecución después de la confirmación "${input.step.label}».`,
    resumable: true,
  };
}

export class DirectorLangGraphPilot {
  private readonly graph = new StateGraph(DirectorLangGraphPilotState)
    .addNode("workspace_analyze", this.workspaceAnalyzeNode.bind(this))
    .addNode("recommend_next_action", this.recommendNextActionNode.bind(this))
    .addNode("run_next_step", this.runNextStepNode.bind(this))
    .addNode("approval_interrupt", this.approvalInterruptNode.bind(this))
    .addEdge(START, "workspace_analyze")
    .addEdge("workspace_analyze", "recommend_next_action")
    .addEdge("recommend_next_action", "run_next_step")
    .addEdge("run_next_step", "approval_interrupt")
    .addEdge("approval_interrupt", END)
    .compile({
      name: "director_langgraph_pilot",
      description: "Low-risk auto director pilot graph for plan routing, interrupt, resume, and trace.",
    });

  constructor(private readonly deps: DirectorLangGraphPilotDeps) {}

  async run(input: DirectorLangGraphPilotInput): Promise<DirectorLangGraphPilotResult> {
    const checkpoint = input.checkpoint ?? null;
    const result = await this.graph.invoke({
      taskId: input.taskId,
      novelId: input.novelId ?? null,
      plan: input.plan,
      checkpoint,
      interruptBeforeStepIds: input.interruptBeforeStepIds ?? [],
      resume: input.resume ?? null,
      completedGraphNodes: checkpoint?.completedGraphNodes ?? [],
      completedStepIds: checkpoint?.completedStepIds ?? [],
      pendingStep: checkpoint?.pendingStep ?? null,
      analysis: null,
      interrupt: checkpoint?.interrupt ?? null,
      status: "completed",
      executedStepIds: [],
      trace: checkpoint?.trace ?? [],
    });

    return {
      status: result.status,
      nextStep: result.pendingStep,
      executedStepIds: result.executedStepIds ?? [],
      interrupt: result.interrupt,
      trace: result.trace ?? [],
      checkpoint: {
        completedGraphNodes: result.completedGraphNodes ?? [],
        completedStepIds: result.completedStepIds ?? [],
        pendingStep: result.pendingStep,
        interrupt: result.interrupt,
        trace: result.trace ?? [],
      },
    };
  }

  private async workspaceAnalyzeNode(state: DirectorLangGraphPilotStateValue) {
    if (hasCompletedGraphNode(state, "workspace_analyze")) {
      return {
        trace: appendTrace(state, {
          node: "workspace_analyze",
          status: "skipped",
          summary: "Se han reutilizado los resultados del último nodo de análisis del espacio de trabajo.",
        }),
      };
    }
    if (!state.novelId) {
      return {
        completedGraphNodes: addCompletedGraphNode(state, "workspace_analyze"),
        trace: appendTrace(state, {
          node: "workspace_analyze",
          status: "skipped",
          summary: "El plan actual no está vinculado a la novela y se omite el análisis del espacio de trabajo.",
        }),
      };
    }
    const analysis = await this.deps.directorRuntime.analyzeWorkspace({
      novelId: state.novelId,
      workflowTaskId: state.taskId,
      includeAiInterpretation: false,
    });
    return {
      analysis,
      completedGraphNodes: addCompletedGraphNode(state, "workspace_analyze"),
      trace: appendTrace(state, {
        node: "workspace_analyze",
        status: "completed",
        summary: "Se han leído los resultados del análisis del espacio de trabajo de DirectorRuntime.",
      }),
    };
  }

  private async recommendNextActionNode(state: DirectorLangGraphPilotStateValue) {
    if (hasCompletedGraphNode(state, "recommend_next_action") && state.pendingStep) {
      return {
        trace: appendTrace(state, {
          node: "recommend_next_action",
          status: "skipped",
          stepId: state.pendingStep.stepId,
          summary: "Se ha reutilizado el último siguiente paso recomendado.",
        }),
      };
    }
    const completedStepIds = new Set(state.completedStepIds ?? []);
    const nextStep = state.plan.steps.find((step) => !completedStepIds.has(step.stepId)) ?? null;
    return {
      pendingStep: nextStep,
      completedGraphNodes: addCompletedGraphNode(state, "recommend_next_action"),
      trace: appendTrace(state, {
        node: "recommend_next_action",
        status: "completed",
        stepId: nextStep?.stepId ?? null,
        summary: nextStep
          ? `Se sugiere que el siguiente paso sea "${nextStep.label}».`
          : "No quedan pasos pendientes en el Plan de flujo de trabajo actual.",
      }),
    };
  }

  private async runNextStepNode(state: DirectorLangGraphPilotStateValue) {
    const step = state.pendingStep;
    if (!step) {
      return {
        status: "completed" as const,
        trace: appendTrace(state, {
          node: "run_next_step",
          status: "skipped",
          summary: "No hay ningún siguiente paso que dar.",
        }),
      };
    }

    const waitingInterrupt = state.interrupt;
    const resume = state.resume;
    const isResumingApprovedInterrupt = Boolean(
      waitingInterrupt
      && resume?.approved
      && resume.interruptId === waitingInterrupt.id,
    );
    const shouldInterrupt = (state.interruptBeforeStepIds ?? []).includes(step.stepId)
      && !isResumingApprovedInterrupt;
    if (shouldInterrupt) {
      const interrupt = createInterrupt({
        taskId: state.taskId,
        step,
      });
      return {
        status: "interrupted" as const,
        interrupt,
        trace: appendTrace(state, {
          node: "run_next_step",
          status: "interrupted",
          stepId: step.stepId,
          summary: `implementar"${step.label}"Esperando confirmación antes".`,
        }),
      };
    }

    await this.deps.runStep?.({
      taskId: state.taskId,
      novelId: state.novelId,
      plan: state.plan,
      step,
    });
    return {
      status: "completed" as const,
      interrupt: null,
      pendingStep: null,
      executedStepIds: unique([...(state.executedStepIds ?? []), step.stepId]),
      completedStepIds: unique([...(state.completedStepIds ?? []), step.stepId]),
      completedGraphNodes: addCompletedGraphNode(state, "run_next_step"),
      trace: appendTrace(state, {
        node: "run_next_step",
        status: "completed",
        stepId: step.stepId,
        summary: `Ejecutado "${step.label}».`,
      }),
    };
  }

  private async approvalInterruptNode(state: DirectorLangGraphPilotStateValue) {
    if (state.status === "interrupted" && state.interrupt) {
      return {
        trace: appendTrace(state, {
          node: "approval_interrupt",
          status: "interrupted",
          stepId: state.interrupt.stepId,
          summary: state.interrupt.summary,
        }),
      };
    }
    return {
      completedGraphNodes: addCompletedGraphNode(state, "approval_interrupt"),
      trace: appendTrace(state, {
        node: "approval_interrupt",
        status: "completed",
        stepId: state.pendingStep?.stepId ?? null,
        summary: "No quedan interrupciones pendientes en esta ronda de ejecución del gráfico.",
      }),
    };
  }
}
