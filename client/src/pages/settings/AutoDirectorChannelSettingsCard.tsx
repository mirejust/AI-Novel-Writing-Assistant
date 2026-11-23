import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AUTO_DIRECTOR_EVENT_OPTIONS,
  type AutoDirectorChannelDraft,
  summarizeSelectedAutoDirectorEvents,
} from "./autoDirectorEventOptions";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

function AutoDirectorEventMultiSelect(props: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { value, onChange } = props;
  const [open, setOpen] = useState(false);

  return (
    <div className="min-w-0 space-y-2">
      <button
        type="button"
        className="flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={`min-w-0 ${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}`}>{summarizeSelectedAutoDirectorEvents(value)}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? "Cerca" : "Expandir"}</span>
      </button>
      {open ? (
        <div className="min-w-0 space-y-2 rounded-md border bg-background p-3">
          {AUTO_DIRECTOR_EVENT_OPTIONS.map((item) => {
            const checked = value.includes(item.code);
            return (
              <label key={item.code} className="flex min-w-0 items-start gap-3 rounded-md border p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...value, item.code]);
                      return;
                    }
                    onChange(value.filter((code) => code !== item.code));
                  }}
                />
                <div className="min-w-0 space-y-1">
                  <div className={`${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText} text-sm font-medium`}>{item.label}</div>
                  <div className={`${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText} text-xs text-muted-foreground`}>{item.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AutoDirectorChannelSettingsCard(props: {
  channelDraft: AutoDirectorChannelDraft;
  onBaseUrlChange: (value: string) => void;
  onPatchChannelDraft: (
    channelType: "dingtalk" | "wecom" | "feishu",
    patch: Partial<AutoDirectorChannelDraft["dingtalk"] & AutoDirectorChannelDraft["feishu"]>,
  ) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    channelDraft,
    onBaseUrlChange,
    onPatchChannelDraft,
    onSave,
    isSaving,
  } = props;
  const toggleLabel = isOpen ? "Configuración del canal de seguimiento de director cercano" : "Ampliar configuración del canal de seguimiento de directores";

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>Configuración del canal de seguimiento del director</CardTitle>
          <CardDescription className={AUTO_DIRECTOR_MOBILE_CLASSES.wrapText}>
            Reciba recordatorios de creación a través de DingTalk, WeChat Business o Feishu y continúe o vuelva a intentar la tarea. Feishu Long Connection es adecuado para usuarios de escritorio y no requiere una dirección de devolución de llamada de red pública.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={isOpen}
          aria-controls="auto-director-channel-settings-content"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen ? "rotate-180" : "")} />
        </Button>
      </CardHeader>
      {isOpen ? (
        <CardContent id="auto-director-channel-settings-content" className="space-y-6">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Dirección de acceso al sitio</div>
            <Input
              value={channelDraft.baseUrl}
              placeholder="https://book.example.com"
              onChange={(event) => onBaseUrlChange(event.target.value)}
            />
            <div className={`${AUTO_DIRECTOR_MOBILE_CLASSES.wrapText} text-xs text-muted-foreground`}>
              Se utiliza para el enlace "Abrir centro de seguimiento/Ver detalles" en mensajes de DingTalk/Qiwei. Si no se completa, recurrirá a la dirección del sitio en el entorno del servidor.
            </div>
          </div>

          {(["dingtalk", "wecom"] as const).map((channelType) => (
            <div key={channelType} className="min-w-0 space-y-3 border-t pt-4">
              <div className="font-medium">{channelType === "dingtalk" ? "DingTalk" : "WeChat empresarial"}</div>
              {channelType === "dingtalk" ? (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Clave de firma secreta (opcional)</div>
                  <Input type="password" value={channelDraft.dingtalk.secret} placeholder="Clave SEC… en la configuración de seguridad del robot"
                    onChange={(event) => onPatchChannelDraft("dingtalk", {secret: event.target.value})} />
                </div>
              ) : null}
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Webhook URL</div>
                  <Input
                    value={channelDraft[channelType].webhookUrl}
                    placeholder="https://..."
                    onChange={(event) => onPatchChannelDraft(channelType, { webhookUrl: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Token de devolución de llamada</div>
                  <Input
                    value={channelDraft[channelType].callbackToken}
                    placeholder="Opcional; si no se configura, solo se conservarán los saltos dentro del sitio."
                    onChange={(event) => onPatchChannelDraft(channelType, { callbackToken: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Mapeo de usuarios JSON</div>
                <Input
                  value={channelDraft[channelType].operatorMapJson}
                  placeholder='{"ding_user_1":"user_1"}'
                  onChange={(event) => onPatchChannelDraft(channelType, { operatorMapJson: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Suscríbete a eventos</div>
                <AutoDirectorEventMultiSelect
                  value={channelDraft[channelType].eventTypes}
                  onChange={(eventTypes) => onPatchChannelDraft(channelType, { eventTypes })}
                />
              </div>
            </div>
          ))}

          <div className="min-w-0 space-y-3 border-t pt-4">
            <div className="font-medium">Conexión larga Feishu/Lark</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={channelDraft.feishu.enabled}
                onChange={(event) => onPatchChannelDraft("feishu", {enabled: event.target.checked})} />Habilite las notificaciones de Feishu y las operaciones con tarjetas
            </label>
            <p className="text-xs text-muted-foreground">Cree una aplicación empresarial de creación propia, habilite el robot y envíe permisos de mensajes; seleccione una conexión larga en la configuración de devolución de llamada de "Eventos y devoluciones de llamada" y suscríbase a card.action.trigger. Agregue el robot al grupo receptor.</p>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {([['appId', 'App ID'], ['appSecret', 'App Secret'], ['receiveId', 'Recepción de ID de grupo o usuario'], ['operatorMapJson', 'Mapeo de usuarios JSON']] as const).map(([field, label]) => (
                <label key={field} className="space-y-1 text-xs text-muted-foreground">
                  <span>{label}</span>
                  <Input type={field === "appSecret" ? "password" : "text"} value={channelDraft.feishu[field]}
                    placeholder={field === "operatorMapJson" ? '{"ID de usuario de ou_Feishu":"ID de usuario del sitio"}' : label}
                    onChange={(event) => onPatchChannelDraft("feishu", {[field]: event.target.value})} />
                </label>
              ))}
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Recibir tipo de ID</span>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={channelDraft.feishu.receiveIdType}
                  onChange={(event) => onPatchChannelDraft("feishu", {receiveIdType: event.target.value as AutoDirectorChannelDraft["feishu"]["receiveIdType"]})}>
                  <option value="chat_id">Chat grupal chat_id</option><option value="open_id">Usuario open_id</option><option value="user_id">Usuario ID_usuario</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Vía de Servício</span>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={channelDraft.feishu.domain}
                  onChange={(event) => onPatchChannelDraft("feishu", {domain: event.target.value as "feishu" | "lark"})}>
                  <option value="feishu">Feishu</option><option value="lark">Lark</option>
                </select>
              </label>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Suscríbete a eventos</div>
              <AutoDirectorEventMultiSelect value={channelDraft.feishu.eventTypes}
                onChange={(eventTypes) => onPatchChannelDraft("feishu", {eventTypes})} />
            </div>
          </div>

          <div className={AUTO_DIRECTOR_MOBILE_CLASSES.channelSettingsActionRow}>
            <Button variant="outline" asChild className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction}>
              <Link to="/settings/models">Ir al enrutamiento del modelo</Link>
            </Button>
            <Button className={AUTO_DIRECTOR_MOBILE_CLASSES.fullWidthAction} onClick={onSave} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar configuración del canal de seguimiento del director"}
            </Button>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
