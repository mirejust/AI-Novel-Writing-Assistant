import type { AutoDirectorChannelSettings } from "@/api/settings";

export interface AutoDirectorEventOption {
  code: string;
  label: string;
  description: string;
}

export interface AutoDirectorChannelDraft {
  baseUrl: string;
  feishu: AutoDirectorChannelSettings["feishu"];
  dingtalk: {
    secret: string;
    webhookUrl: string;
    callbackToken: string;
    operatorMapJson: string;
    eventTypes: string[];
  };
  wecom: {
    webhookUrl: string;
    callbackToken: string;
    operatorMapJson: string;
    eventTypes: string[];
  };
}

export const AUTO_DIRECTOR_EVENT_OPTIONS: AutoDirectorEventOption[] = [
  {
    code: "auto_director.approval_required",
    label: "Continuar siendo procesado automáticamente",
    description: "La tarjeta de director automática le notifica cuando es necesario continuar o confirmar un nodo.",
  },
  {
    code: "auto_director.auto_approved",
    label: "La IA ha pasado automáticamente",
    description: "El sistema le notifica cuando pasa el punto de control y continúa la ejecución según lo autorizado por la aprobación.",
  },
  {
    code: "auto_director.exception",
    label: "Operación anormal",
    description: "Notificarle cuando la ejecución automática del director informe un error, falle o entre en un estado anormal.",
  },
  {
    code: "auto_director.recovered",
    label: "Recuperación de excepción",
    description: "Se le notificará cuando la tarea del director automático previamente anormal reanude su ejecución.",
  },
  {
    code: "auto_director.completed",
    label: "Ejecución completada",
    description: "Notificarle automáticamente cuando una tarea del director complete con éxito la etapa actual o el proceso general.",
  },
  {
    code: "auto_director.progress_changed",
    label: "Cambios de progreso",
    description: "Notificarle automáticamente sobre cambios de progreso críticos o entre etapas.",
  },
];

const AUTO_DIRECTOR_EVENT_LABEL_MAP = new Map(
  AUTO_DIRECTOR_EVENT_OPTIONS.map((item) => [item.code, item.label]),
);

export function buildAutoDirectorChannelDraft(
  settings?: AutoDirectorChannelSettings | null,
): AutoDirectorChannelDraft {
  return settings ? {
    baseUrl: settings.baseUrl,
    feishu: settings.feishu ?? {enabled: false, appId: "", appSecret: "", receiveId: "", receiveIdType: "chat_id", domain: "feishu", operatorMapJson: "", eventTypes: []},
    dingtalk: {
      secret: settings.dingtalk.secret ?? "",
      webhookUrl: settings.dingtalk.webhookUrl,
      callbackToken: settings.dingtalk.callbackToken,
      operatorMapJson: settings.dingtalk.operatorMapJson,
      eventTypes: settings.dingtalk.eventTypes,
    },
    wecom: {
      webhookUrl: settings.wecom.webhookUrl,
      callbackToken: settings.wecom.callbackToken,
      operatorMapJson: settings.wecom.operatorMapJson,
      eventTypes: settings.wecom.eventTypes,
    },
  } : {
    baseUrl: "",
    feishu: {enabled: false, appId: "", appSecret: "", receiveId: "", receiveIdType: "chat_id", domain: "feishu", operatorMapJson: "", eventTypes: []},
    dingtalk: {
      secret: "",
      webhookUrl: "",
      callbackToken: "",
      operatorMapJson: "",
      eventTypes: [],
    },
    wecom: {
      webhookUrl: "",
      callbackToken: "",
      operatorMapJson: "",
      eventTypes: [],
    },
  };
}

export function summarizeSelectedAutoDirectorEvents(codes: string[]): string {
  const labels = codes
    .map((code) => AUTO_DIRECTOR_EVENT_LABEL_MAP.get(code))
    .filter((label): label is string => Boolean(label));
  if (labels.length === 0) {
    return "No suscrito a eventos";
  }
  if (labels.length <= 2) {
    return labels.join(",");
  }
  return `${labels.slice(0, 2).join(",")} esperar ${labels.length} artículo`;
}
