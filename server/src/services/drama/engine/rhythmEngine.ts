/**
 * 竖屏付费短剧节奏引擎（P1 核心 · 平台护城河）
 *
 * 把竖屏付费短剧的真实创作法则落成确定性、可配置的规则集：
 * 钩子类型库 / 赛道模板库 / 付费卡点策略 / 情绪曲线目标。
 *
 * 这是来源无关的纯领域知识，不依赖 LLM、不依赖任何外部模块，
 * 供策略规划与分集大纲阶段查询与约束。
 */

// ============================================================
// 钩子类型库
// ============================================================
export type HookTypeId =
  | "identity_reversal" // 身份反转
  | "face_slap" // 打脸
  | "hidden_strength" // 扮猪吃老虎/实力隐藏
  | "mask_drop" // 马甲掉落
  | "misunderstanding" // 误会
  | "crisis" // 危机降临
  | "emotional_tug" // 情感拉扯
  | "crushing_power" // 实力碾压
  | "villain_provoke" // 反派挑衅
  | "secret_reveal"; // 秘密揭露

export interface HookType {
  id: HookTypeId;
  label: string;
  description: string;
  /** 适合放在开场钩子还是集尾卡点，或两者皆可 */
  placement: "opening" | "cliffhanger" | "both";
}

export const HOOK_TYPES: readonly HookType[] = [
  { id: "identity_reversal", label: "inversión de identidad", description: "La verdadera identidad oculta se revela o se insinúa parcialmente, subvirtiendo las percepciones de los demás.", placement: "both" },
  { id: "face_slap", label: "cachete", description: "Las personas que alguna vez despreciaron/humillaron al protagonista fueron derrotadas por la realidad en público, lo cual es refrescante para el núcleo de alta frecuencia.", placement: "both" },
  { id: "hidden_strength", label: "Finge ser un cerdo y cómete al tigre.", description: "El protagonista muestra deliberadamente debilidad y su fuerza queda expuesta en puntos clave.", placement: "both" },
  { id: "mask_drop", label: "chaleco caído", description: "Se revela el título/poder/riqueza ocultos del protagonista.", placement: "cliffhanger" },
  { id: "misunderstanding", label: "Entender mal", description: "La brecha de información crea conflicto. El público lo sabe pero los personajes no, lo que genera tensión.", placement: "opening" },
  { id: "crisis", label: "Se acerca la crisis", description: "Una amenaza repentina se acerca al protagonista o a alguien importante para él, creando urgencia.", placement: "both" },
  { id: "emotional_tug", label: "Atracción emocional", description: "La ambigüedad/malentendido/falta impulsa la línea emocional y retiene la emoción en la audiencia.", placement: "cliffhanger" },
  { id: "crushing_power", label: "Aplastar por la fuerza", description: "El protagonista resuelve una situación aparentemente irresoluble con absoluta ventaja, liberando una sensación de satisfacción.", placement: "both" },
  { id: "villain_provoke", label: "Provocación villana", description: "El villano avanza paso a paso o provoca en público, acumulando las emociones reprimidas del público.", placement: "opening" },
  { id: "secret_reveal", label: "secreto revelado", description: "Se revelan secretos clave/presagios, lo que lleva la trama a una nueva etapa.", placement: "cliffhanger" },
] as const;

// ============================================================
// 赛道模板库
// ============================================================
export type TrackId =
  | "counterattack" // 逆袭
  | "rebirth_revenge" // 重生复仇
  | "war_god" // 战神归来
  | "live_in_son" // 赘婿
  | "miracle_doctor" // 神医
  | "rich_family" // 豪门恩怨
  | "sweet_love" // 甜宠
  | "hidden_identity"; // 马甲文

export interface TrackTemplate {
  id: TrackId;
  label: string;
  description: string;
  /** 典型人设组合 */
  typicalArchetypes: string[];
  /** 该赛道偏好的钩子类型 */
  preferredHooks: HookTypeId[];
  /** 爽点节奏说明 */
  rhythmNote: string;
  /** 赛道禁忌（黑名单），避免拖节奏/劝退 */
  taboos: string[];
}

export const TRACK_TEMPLATES: readonly TrackTemplate[] = [
  {
    id: "counterattack",
    label: "Contraataque",
    description: "El protagonista pasivo/presionado depende de la fuerza o la oportunidad para darse la vuelta, y con frecuencia recibe una bofetada.",
    typicalArchetypes: ["Hazte pasar por un cerdo y cómete al tigre protagonista.", "personaje secundario snob", "villano arrogante"],
    preferredHooks: ["face_slap", "hidden_strength", "crushing_power", "villain_provoke"],
    rhythmNote: "Recoge 1-2 para soltar una bofetada; paga por la máxima cantidad de frustración antes de dar el contraataque más fuerte.",
    taboos: ["El protagonista soportó su ira durante mucho tiempo sin defenderse.", "Grandes párrafos de explicación de antecedentes.", "descripción del entorno"],
  },
  {
    id: "rebirth_revenge",
    label: "Renacimiento para la venganza",
    description: "El protagonista renace con recuerdos de su vida pasada y se venga de sus enemigos.",
    typicalArchetypes: ["Protagonista de la venganza renacida", "Enemigos de vidas pasadas", "El benefactor que le debía en mi vida anterior."],
    preferredHooks: ["secret_reveal", "face_slap", "identity_reversal", "crisis"],
    rhythmNote: "Utilice información profética para crear una venganza aplastante; Cada episodio cumple una venganza inacabada de una vida anterior.",
    taboos: ["La venganza se retrasa y no se cumple", "El corazón de la madre del protagonista suelta al enemigo.", "Recuerdos repetidos de vidas pasadas."],
  },
  {
    id: "war_god",
    label: "El regreso del dios de la guerra",
    description: "El hombre fuerte retirado/abandonado regresa para proteger sus defectos y barrer con venganza.",
    typicalArchetypes: ["Hazte pasar por un cerdo y cómete al tigre God of War", "La familia política menosprecia a los demás.", "Fuerte enemigo externo"],
    preferredHooks: ["mask_drop", "crushing_power", "villain_provoke", "identity_reversal"],
    rhythmNote: "El chaleco se quita capa por capa y la fuerza se mejora y se aplasta una y otra vez.",
    taboos: ["Exponer todas tus cartas demasiado pronto", "El sistema de poder de combate es caótico.", "Mostrar debilidad sin motivo"],
  },
  {
    id: "live_in_son",
    label: "yerno",
    description: "El yerno despreciado que vino de visita era en realidad un jefe oculto y lo abofetearon.",
    typicalArchetypes: ["Identidad oculta del yerno", "suegros esnobs", "Ponerle las cosas difíciles al cuñado"],
    preferredHooks: ["hidden_strength", "face_slap", "mask_drop", "villain_provoke"],
    rhythmNote: "Ser humillado y ganar impulso → identidad/fuerza expuesta → abofeteado en público, el ciclo se intensifica.",
    taboos: ["La familia Yue es tan estúpida que está distorsionada.", "El protagonista ha sido cobarde durante demasiado tiempo.", "La identidad se reveló demasiado rápido y no hubo tensión."],
  },
  {
    id: "miracle_doctor",
    label: "doctor milagroso",
    description: "Un médico con habilidades extraordinarias vino a revivir a los muertos y sus habilidades superaron a las de otros médicos.",
    typicalArchetypes: ["Doctor haciéndose pasar por un cerdo y comiéndose un tigre", "experto arrogante", "buscar tratamiento medico"],
    preferredHooks: ["crushing_power", "face_slap", "crisis", "secret_reveal"],
    rhythmNote: "Abofeteando a la autoridad con un rejuvenecimiento magistral una y otra vez, aplastando profesionalmente y creando puntos interesantes.",
    taboos: ["Defectos del sentido común médico", "El proceso de tratamiento es largo.", "Pura brillantez sin conflicto"],
  },
  {
    id: "rich_family",
    label: "Rencores entre familias adineradas",
    description: "La lucha por el poder, la propiedad y el misterio de la propia experiencia de vida dentro de una familia rica están entrelazados.",
    typicalArchetypes: ["Hija angustiada/heredera oculta", "parientes viciosos", "Shen Shen Patriarca"],
    preferredHooks: ["identity_reversal", "secret_reveal", "emotional_tug", "face_slap"],
    rhythmNote: "Las experiencias de vida/propiedades/emociones van de la mano con múltiples giros y vueltas en cada episodio.",
    taboos: ["Las relaciones entre personajes son confusas y difíciles de recordar.", "No desgarrar ningún incremento de información", "ritmo lento"],
  },
  {
    id: "sweet_love",
    label: "dulce mascota",
    description: "La línea de amor con un fuerte gancho emocional alterna entre esparcir azúcar y tirar.",
    typicalArchetypes: ["protagonista masculino de alto rango", "heroína terca", "amor rival"],
    preferredHooks: ["emotional_tug", "misunderstanding", "identity_reversal", "crisis"],
    rhythmNote: "Los postres y los abusos se alternan, dejando un suspenso emocional al final del episodio.",
    taboos: ["Sin cerebro, dulce y sin tensiones.", "El malentendido dura demasiado y se convierte en abuso", "El protagonista masculino es grasiento y cruza la línea."],
  },
  {
    id: "hidden_identity",
    label: "Ma Jia Wen",
    description: "Las múltiples identidades ocultas del protagonista fueron reveladas una por una, sorprendiendo a la audiencia.",
    typicalArchetypes: ["Protagonista con múltiples chalecos.", "escépticos", "admirador"],
    preferredHooks: ["mask_drop", "identity_reversal", "face_slap", "secret_reveal"],
    rhythmNote: "Se deja caer un chaleco cada pocos episodios, lo que aumenta la cantidad de capas para crear puntos sorpresa.",
    taboos: ["Demasiados chalecos para recordar", "La caída del chaleco es brusca y sin presagio alguno.", "La identidad no tiene valor."],
  },
] as const;

// ============================================================
// 付费卡点策略 & 情绪曲线
// ============================================================
export interface PaywallStrategy {
  /** 免费引流集数：前 N 集免费，必须立住主爽点与追剧动力 */
  freeEpisodes: number;
  /** 首付费点：卡在第一个大反转/情绪最高点 */
  firstPaywallAt: number;
  /** 之后每隔几集设强卡点（1=每集集尾都卡） */
  paywallCadence: number;
}

/** 竖屏付费短剧默认卡点策略 */
export const DEFAULT_PAYWALL_STRATEGY: PaywallStrategy = {
  freeEpisodes: 10,
  firstPaywallAt: 12,
  paywallCadence: 1,
};

export interface EmotionCurveTarget {
  description: string;
  /** 每个滑动窗口（集）内情绪净值至少要有一次正向释放 */
  releaseEveryEpisodes: number;
  /** 付费点前允许的最大憋屈蓄势深度（负值） */
  maxBuildupDepth: number;
}

export const DEFAULT_EMOTION_CURVE: EmotionCurveTarget = {
  description: "Sufrir y acumular impulso → liberación inversa → nuevo gancho; hay un punto de liberación cada 1 o 2 episodios, y la asfixia máxima se acumula antes del punto de pago y luego se otorga la liberación más fuerte.",
  releaseEveryEpisodes: 2,
  maxBuildupDepth: -3,
};

// ============================================================
// 引擎
// ============================================================
export class RhythmEngine {
  listHooks(): readonly HookType[] {
    return HOOK_TYPES;
  }

  getHook(id: HookTypeId): HookType | undefined {
    return HOOK_TYPES.find((hook) => hook.id === id);
  }

  listTracks(): readonly TrackTemplate[] {
    return TRACK_TEMPLATES;
  }

  getTrack(id: TrackId): TrackTemplate | undefined {
    return TRACK_TEMPLATES.find((track) => track.id === id);
  }

  /** 该赛道推荐的钩子类型（完整对象） */
  recommendHooksForTrack(id: TrackId): HookType[] {
    const track = this.getTrack(id);
    if (!track) {
      return [];
    }
    return track.preferredHooks
      .map((hookId) => this.getHook(hookId))
      .filter((hook): hook is HookType => Boolean(hook));
  }

  /**
   * 计算付费卡点集号列表（1-based）。
   * 首付费点起，按 cadence 标记强卡点，直到总集数。
   */
  buildPaywallPlan(targetEpisodes: number, strategy: PaywallStrategy = DEFAULT_PAYWALL_STRATEGY): number[] {
    const plan: number[] = [];
    const cadence = Math.max(1, strategy.paywallCadence);
    for (let ep = strategy.firstPaywallAt; ep <= targetEpisodes; ep += cadence) {
      plan.push(ep);
    }
    return plan;
  }

  /** 某集是否为付费卡点集 */
  isPaywallEpisode(
    episodeOrder: number,
    targetEpisodes: number,
    strategy: PaywallStrategy = DEFAULT_PAYWALL_STRATEGY,
  ): boolean {
    if (episodeOrder < strategy.firstPaywallAt || episodeOrder > targetEpisodes) {
      return false;
    }
    const cadence = Math.max(1, strategy.paywallCadence);
    return (episodeOrder - strategy.firstPaywallAt) % cadence === 0;
  }
}

export const rhythmEngine = new RhythmEngine();
