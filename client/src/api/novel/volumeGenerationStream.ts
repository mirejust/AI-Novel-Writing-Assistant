import type { ApiResponse } from "@ai-novel/shared/types/api";
import type { VolumeChapterListProgress } from "@ai-novel/shared/types/volumePlanning";
import type { VolumeGenerationResponse } from "./volumes";

type VolumeGenerationFrame =
  | { type: "progress"; event: { chapterProgress?: VolumeChapterListProgress } }
  | { type: "done"; response: ApiResponse<VolumeGenerationResponse> }
  | { type: "error"; error: string }
  | { type: "ping" };

export async function consumeVolumeGenerationStream(
  response: Response,
  onProgress: (progress: VolumeChapterListProgress) => void,
): Promise<ApiResponse<VolumeGenerationResponse>> {
  if (!response.ok || !response.body) {
    throw new Error(`Solicitud fallida, código de estado ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const rawFrame of frames) {
        const data = rawFrame.split("\n").find(line => line.startsWith("data:"));
        if (!data) continue;
        const frame = JSON.parse(data.slice(5)) as VolumeGenerationFrame;
        if (frame.type === "error") throw new Error(frame.error);
        if (frame.type === "progress" && frame.event.chapterProgress) onProgress(frame.event.chapterProgress);
        if (frame.type === "done") return frame.response;
      }
    }
    throw new Error("La conexión de descompresión fue interrumpida. Verifique el espacio de trabajo del volumen e inténtelo nuevamente.");
  } finally {
    reader.releaseLock();
  }
}
