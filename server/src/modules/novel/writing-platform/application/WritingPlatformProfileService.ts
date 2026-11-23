import type {
  WritingPlatform,
  WritingPlatformProfileDefinition,
  WritingPlatformProfileVersionView,
  WritingPlatformSnapshot,
} from "@ai-novel/shared/types/writingPlatform";
import { prisma } from "../../../../db/prisma";
import {
  OFFICIAL_WRITING_PLATFORM_PROFILES,
  WRITING_PLATFORM_VALUES,
  supportsWritingPlatformForm,
} from "../domain/officialWritingPlatformProfiles";

function parseProfile(raw: string): WritingPlatformProfileDefinition {
  return JSON.parse(raw) as WritingPlatformProfileDefinition;
}

function validateProfile(platform: WritingPlatform, profile: WritingPlatformProfileDefinition): void {
  if (profile.platform !== platform) throw new Error("La identificación de la plataforma no se puede cambiar durante la edición.");
  if (!profile.label.trim() || !profile.summary.trim()) throw new Error("El nombre y la descripción de la plataforma no pueden estar vacíos.");
  for (const form of profile.supportedNarrativeForms) {
    const guidance = profile.guidance[form];
    if (!guidance || Object.values(guidance).some((value) => !value.trim())) {
      throw new Error(`Por favor complete completamente ${form === "short_story" ? "cuento corto" : "larga historia"} Cinco categorías de orientación para la escritura.`);
    }
  }
}

export class WritingPlatformProfileService {
  async list(): Promise<Array<{ profile: WritingPlatformProfileDefinition; activeVersion: number; source: "official" | "custom" }>> {
    return Promise.all(WRITING_PLATFORM_VALUES.map(async (platform) => {
      const resolved = await this.resolve(platform);
      return { profile: resolved.profile, activeVersion: resolved.version, source: resolved.source };
    }));
  }

  async get(platform: WritingPlatform): Promise<{
    profile: WritingPlatformProfileDefinition;
    activeVersion: number;
    source: "official" | "custom";
    versions: WritingPlatformProfileVersionView[];
  }> {
    const official = OFFICIAL_WRITING_PLATFORM_PROFILES[platform];
    const override = await prisma.writingPlatformProfileOverride.findUnique({
      where: { platform },
      include: { versions: { orderBy: { versionNo: "desc" } } },
    });
    const active = override?.activeVersionId
      ? override.versions.find((item) => item.id === override.activeVersionId) ?? null
      : null;
    return {
      profile: active ? parseProfile(active.profileJson) : official,
      activeVersion: active?.versionNo ?? official.officialVersion,
      source: active ? "custom" : "official",
      versions: (override?.versions ?? []).map((item) => ({
        id: item.id,
        platform,
        versionNo: item.versionNo,
        profile: parseProfile(item.profileJson),
        notes: item.notes,
        active: item.id === override?.activeVersionId,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async save(platform: WritingPlatform, profile: WritingPlatformProfileDefinition, notes?: string): Promise<Awaited<ReturnType<WritingPlatformProfileService["get"]>>> {
    validateProfile(platform, profile);
    const override = await prisma.writingPlatformProfileOverride.upsert({
      where: { platform },
      create: { platform },
      update: {},
      include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
    });
    const version = await prisma.writingPlatformProfileVersion.create({
      data: {
        overrideId: override.id,
        versionNo: (override.versions[0]?.versionNo ?? 0) + 1,
        profileJson: JSON.stringify(profile),
        notes: notes?.trim() || null,
      },
    });
    await prisma.writingPlatformProfileOverride.update({
      where: { id: override.id },
      data: { activeVersionId: version.id },
    });
    return this.get(platform);
  }

  async activate(platform: WritingPlatform, versionId: string): Promise<Awaited<ReturnType<WritingPlatformProfileService["get"]>>> {
    const override = await prisma.writingPlatformProfileOverride.findUnique({ where: { platform } });
    if (!override) throw new Error("Aún no existe una versión personalizada del método de escritura de la plataforma.");
    const version = await prisma.writingPlatformProfileVersion.findFirst({ where: { id: versionId, overrideId: override.id } });
    if (!version) throw new Error("La versión de escritura de la plataforma no existe.");
    await prisma.writingPlatformProfileOverride.update({ where: { id: override.id }, data: { activeVersionId: version.id } });
    return this.get(platform);
  }

  async restoreOfficial(platform: WritingPlatform): Promise<Awaited<ReturnType<WritingPlatformProfileService["get"]>>> {
    await prisma.writingPlatformProfileOverride.updateMany({ where: { platform }, data: { activeVersionId: null } });
    return this.get(platform);
  }

  async resolve(platform: WritingPlatform): Promise<{ profile: WritingPlatformProfileDefinition; version: number; source: "official" | "custom" }> {
    const result = await this.get(platform);
    return { profile: result.profile, version: result.activeVersion, source: result.source };
  }

  async snapshot(platform: WritingPlatform, narrativeForm: "short_story" | "long_novel"): Promise<WritingPlatformSnapshot> {
    if (!supportsWritingPlatformForm(platform, narrativeForm)) throw new Error("La plataforma seleccionada no admite el tamaño de producción actual.");
    const resolved = await this.resolve(platform);
    const guidance = resolved.profile.guidance[narrativeForm];
    if (!guidance) throw new Error("El método de escritura de la plataforma carece de la configuración de la escala de trabajo actual.");
    return {
      platform,
      label: resolved.profile.label,
      narrativeForm,
      profileVersion: resolved.version,
      source: resolved.source,
      guidance,
    };
  }
}

export const writingPlatformProfileService = new WritingPlatformProfileService();
