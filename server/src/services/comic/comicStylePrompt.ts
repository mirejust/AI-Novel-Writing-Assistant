/**
 * 漫画画风关键词解析（单一来源）
 *
 * 所有漫画相关图像生成（角色三视图、表情稿、角色资产、场景设定图、格子图）
 * 都应通过此函数注入项目画风，保证整本风格统一。
 *
 * 画风来自 ComicProject.stylePreset(JSON).style（webtoon_color / ink_traditional 等）；
 * 注意 stylePreset.promptKeywords 是「漫画形态」（竖条漫/四格）关键词，不是画风。
 */

interface StyleEntry {
  zh: string;
  en: string;
}

// 与前端 ComicProjectPage STYLE_OPTIONS 的 value 对应
const STYLE_KEYWORDS: Record<string, StyleEntry> = {
  webtoon_color: { zh: "Colorido estilo cómico coreano, líneas limpias, colores brillantes.", en: "Korean webtoon style, clean line art, vibrant colors" },
  bl_manga: { zh: "Estilo manga femenino colorido, tonos suaves, rasgos faciales delicados.", en: "shoujo manga style, soft palette, delicate features" },
  shounen_bw: { zh: "Estilo cómico shonen en blanco y negro, líneas ásperas, composición dinámica", en: "black-and-white shounen manga, bold ink line art, dynamic composition" },
  ink_traditional: { zh: "Estilo chino de tinta y lavado, pinceladas tradicionales, manchas de colores claros", en: "traditional Chinese ink-wash painting style, brush strokes, muted washed colors" },
  chibi: { zh: "Versión Q de lindo estilo de dibujos animados, expresiones redondas y lindas, exageradas.", en: "chibi / SD cute manga style, round soft proportions" },
  realistic: { zh: "Estilo cómico realista, luces y sombras delicadas, realismo.", en: "semi-realistic illustration style, detailed shading and lighting" },
};

const DEFAULT_STYLE: StyleEntry = STYLE_KEYWORDS.webtoon_color;

function resolveStyleEntry(stylePresetRaw: string | null | undefined): StyleEntry {
  if (!stylePresetRaw) return DEFAULT_STYLE;
  try {
    const parsed = JSON.parse(stylePresetRaw) as { style?: string };
    if (parsed.style && STYLE_KEYWORDS[parsed.style]) return STYLE_KEYWORDS[parsed.style];
  } catch { /* ignore */ }
  return DEFAULT_STYLE;
}

/** 返回中英组合画风关键词串，直接拼入图像 prompt */
export function resolveComicStyleKeywords(stylePresetRaw: string | null | undefined): string {
  const entry = resolveStyleEntry(stylePresetRaw);
  return `${entry.zh},${entry.en}`;
}

/** 仅英文画风片段（用于以英文为主的 prompt） */
export function resolveComicStyleKeywordsEn(stylePresetRaw: string | null | undefined): string {
  return resolveStyleEntry(stylePresetRaw).en;
}

// ─── 性别强约束 ───────────────────────────────────────────────────────────────
// 漫画里"鹅蛋脸、桃花眼、媚意、傲娇"等描述在古风/韩漫语境对男女都通用，
// 模型默认会偏向"美男"。所有生图链路（三视图/表情稿/资产/格子图）必须显式声明性别。

/** 把 ComicCharacter.gender 转成强约束 prompt 片段；unknown/缺省时返回空串（不注入） */
export function buildGenderLockPrompt(
  gender: string | null | undefined,
  characterName?: string,
): string {
  switch (gender) {
    case "male":
      return [
        `*** GENDER LOCK ***: ${characterName ?? "this character"} is MALE`,
        "render with masculine anatomy: male facial bone structure, male shoulder/torso proportions, Adam's apple, masculine hairline; NOT feminine",
        "Chino: este personaje es un hombre. El género en la imagen debe ser correcto. No lo dibujes como una mujer.",
      ].join(", ");
    case "female":
      return [
        `*** GENDER LOCK ***: ${characterName ?? "this character"} is FEMALE`,
        "render with feminine anatomy: female facial bone structure, female body proportions, feminine hairline; NOT masculine",
        "Chino: este personaje es femenino. El género en la imagen debe ser correcto. No lo dibujes como un hombre o un niño neutral.",
      ].join(", ");
    case "other":
      // 中性/非二元：不强约束某一性别，但提示不要随机偏向
      return `*** GENDER NOTE ***: ${characterName ?? "this character"} has androgynous / non-binary presentation, respect the appearance description above; do not force masculine or feminine defaults`;
    case "unknown":
    case null:
    case undefined:
    default:
      return "";
  }
}
