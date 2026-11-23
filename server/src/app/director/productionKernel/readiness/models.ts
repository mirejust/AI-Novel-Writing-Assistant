import type {RunContract} from "../../../../modules/director";
import {captureKernelModelPolicy, type KernelModelPolicySources} from "../modelPolicy/source";
import {AppError} from "../../../../middleware/errorHandler";
import type {KernelReadiness, KernelReadinessIssue} from "./storage";
import type {KernelModelPolicy} from "../modelPolicy/types";
import {MissingTaskOutputBudgetError} from "../../../../platform/llm/execution";

export class KernelReadinessError extends AppError {
  readonly code: KernelReadinessIssue["code"];
  constructor(issue: KernelReadinessIssue) {super(issue.message, 503); this.code = issue.code; this.name = "KernelReadinessError";}
}
export function outputBudgetReadinessIssue(error: MissingTaskOutputBudgetError): KernelReadinessIssue {
  return {code:"production_output_budget_capture_missing", message:error.message};
}
export async function inspectKernelModels(contract: RunContract, sources?: KernelModelPolicySources,
  saved?: KernelModelPolicy): Promise<KernelReadiness> {
  try {await captureKernelModelPolicy(contract, sources, saved); return {ready: true};}
  catch (error) {
    if (error instanceof MissingTaskOutputBudgetError) return {ready:false, issues:[outputBudgetReadinessIssue(error)]};
    return {ready:false, issues:[{code:"production_model_capability_missing",
      message:"La configuración del modelo principal no está lista. Verifique la ventana contextual y el límite superior de salida de los modelos activo y en espera."}]};
  }
}
