import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAutoDirectorApprovalPreferenceSettings,
  getAutoDirectorChannelSettings,
  getAutoDirectorIssuePolicy,
  getPendingReviewAutoPromotionSettings,
  saveAutoDirectorApprovalPreferenceSettings,
  saveAutoDirectorChannelSettings,
  saveAutoDirectorIssuePolicy,
  savePendingReviewAutoPromotionSettings,
} from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { AutoDirectorApprovalPreferenceCard } from "./AutoDirectorApprovalPreferenceCard";
import { AutoDirectorBrowserNotificationSettingsCard } from "./AutoDirectorBrowserNotificationSettingsCard";
import { AutoDirectorChannelSettingsCard } from "./AutoDirectorChannelSettingsCard";
import { AutoDirectorPendingReviewAutoPromotionCard } from "./AutoDirectorPendingReviewAutoPromotionCard";
import { AutoDirectorIssuePolicyCard } from "./AutoDirectorIssuePolicyCard";
import {
  buildAutoDirectorChannelDraft,
  type AutoDirectorChannelDraft,
} from "./autoDirectorEventOptions";

import {ChapterBudgetSettingsSection} from "./director/ChapterBudgetSettingsSection";

export default function AutoDirectorSettingsSection(props: {
  onActionResult: (message: string) => void;
  collapseAdvanced?: boolean;
}) {
  const { onActionResult, collapseAdvanced = false } = props;
  const queryClient = useQueryClient();
  const [autoDirectorChannelDraft, setAutoDirectorChannelDraft] = useState<AutoDirectorChannelDraft | null>(null);
  const [approvalPreferenceDraft, setApprovalPreferenceDraft] = useState<string[] | null>(null);

  const autoDirectorChannelsQuery = useQuery({
    queryKey: queryKeys.settings.autoDirectorChannels,
    queryFn: getAutoDirectorChannelSettings,
  });
  const approvalPreferenceQuery = useQuery({
    queryKey: queryKeys.settings.autoDirectorApprovalPreferences,
    queryFn: getAutoDirectorApprovalPreferenceSettings,
  });
  const issuePolicyQuery = useQuery({
    queryKey: queryKeys.settings.autoDirectorIssuePolicy,
    queryFn: getAutoDirectorIssuePolicy,
  });
  const pendingReviewAutoPromotionQuery = useQuery({
    queryKey: queryKeys.settings.pendingReviewAutoPromotion,
    queryFn: getPendingReviewAutoPromotionSettings,
  });
  const autoDirectorChannels = autoDirectorChannelsQuery.data?.data;
  const approvalPreference = approvalPreferenceQuery.data?.data;
  const pendingReviewAutoPromotion = pendingReviewAutoPromotionQuery.data?.data;
  const issuePolicy = issuePolicyQuery.data?.data;
  const channelDraft = autoDirectorChannelDraft ?? buildAutoDirectorChannelDraft(autoDirectorChannels);
  const approvalCodes = approvalPreferenceDraft ?? approvalPreference?.approvalPointCodes ?? [];

  const saveAutoDirectorChannelsMutation = useMutation({
    mutationFn: saveAutoDirectorChannelSettings,
    onSuccess: async (response) => {
      onActionResult(response.message ?? "Se guardó la configuración del canal de seguimiento del director.");
      if (response.data) {
        setAutoDirectorChannelDraft(buildAutoDirectorChannelDraft(response.data));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.autoDirectorChannels });
    },
    onError: (error) => {
      onActionResult(error instanceof Error ? error.message : "No se pudo guardar la configuración del canal de seguimiento del director.");
    },
  });

  const saveApprovalPreferenceMutation = useMutation({
    mutationFn: saveAutoDirectorApprovalPreferenceSettings,
    onSuccess: async (response) => {
      onActionResult(response.message ?? "Preferencias de autorización de aprobación guardadas.");
      if (response.data) {
        setApprovalPreferenceDraft(response.data.approvalPointCodes);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.autoDirectorApprovalPreferences });
    },
    onError: (error) => {
      onActionResult(error instanceof Error ? error.message : "No se pudieron guardar las preferencias de autorización de aprobación.");
    },
  });

  const savePendingReviewAutoPromotionMutation = useMutation({
    mutationFn: savePendingReviewAutoPromotionSettings,
    onSuccess: async (response) => {
      onActionResult(response.message ?? "Se ha guardado la configuración de liberación automática del estado de confirmación pendiente.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.pendingReviewAutoPromotion });
    },
    onError: (error) => {
      onActionResult(error instanceof Error ? error.message : "No se pudo guardar la configuración de liberación automática en estado de confirmación pendiente.");
    },
  });
  const saveIssuePolicyMutation = useMutation({
    mutationFn: saveAutoDirectorIssuePolicy,
    onSuccess: async (response) => {
      onActionResult(response.message ?? "Se han guardado las reglas de manejo de problemas.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.autoDirectorIssuePolicy });
    },
    onError: (error) => {
      onActionResult(error instanceof Error ? error.message : "No se pudieron guardar las reglas de manejo de problemas.");
    },
  });

  const patchChannelDraft = (
    channelType: "dingtalk" | "wecom" | "feishu",
    patch: Partial<(typeof channelDraft)["dingtalk"] & (typeof channelDraft)["feishu"]>,
  ) => {
    setAutoDirectorChannelDraft((prev) => {
      const current = prev ?? channelDraft;
      return {
        ...current,
        [channelType]: {
          ...current[channelType],
          ...patch,
        },
      };
    });
  };

  return (
    <>
      <ChapterBudgetSettingsSection />
      <AutoDirectorBrowserNotificationSettingsCard onActionResult={onActionResult} />

      <AutoDirectorIssuePolicyCard
        policy={issuePolicy}
        isLoading={issuePolicyQuery.isLoading}
        isSaving={saveIssuePolicyMutation.isPending}
        onSave={(nextPolicy) => saveIssuePolicyMutation.mutate(nextPolicy)}
      />

      <AutoDirectorApprovalPreferenceCard
        settings={approvalPreference}
        draftCodes={approvalCodes}
        onDraftCodesChange={setApprovalPreferenceDraft}
        onSave={() => saveApprovalPreferenceMutation.mutate({
          approvalPointCodes: approvalCodes,
        })}
        isSaving={saveApprovalPreferenceMutation.isPending}
      />

      {collapseAdvanced ? (
        <details className="rounded-md border bg-muted/20 p-4">
          <summary className="cursor-pointer text-sm font-medium">Control avanzado</summary>
          <div className="mt-4 space-y-4">
            <AdvancedControls />
          </div>
        </details>
      ) : <AdvancedControls />}
    </>
  );

  function AdvancedControls() {
    return <>
      <AutoDirectorPendingReviewAutoPromotionCard
        settings={pendingReviewAutoPromotion}
        isLoading={pendingReviewAutoPromotionQuery.isLoading}
        isSaving={savePendingReviewAutoPromotionMutation.isPending}
        onEnable={(payload) => savePendingReviewAutoPromotionMutation.mutate({ enabled: true, acknowledgedRisks: payload.acknowledgedRisks, confirmationText: payload.confirmationText })}
        onDisable={() => savePendingReviewAutoPromotionMutation.mutate({ enabled: false })}
      />
      <AutoDirectorChannelSettingsCard
        channelDraft={channelDraft}
        onBaseUrlChange={(value) => setAutoDirectorChannelDraft((prev) => ({ ...(prev ?? channelDraft), baseUrl: value }))}
        onPatchChannelDraft={patchChannelDraft}
        onSave={() => saveAutoDirectorChannelsMutation.mutate({
          baseUrl: channelDraft.baseUrl.trim(),
          feishu: channelDraft.feishu,
          dingtalk: { secret: channelDraft.dingtalk.secret.trim(), webhookUrl: channelDraft.dingtalk.webhookUrl.trim(), callbackToken: channelDraft.dingtalk.callbackToken.trim(), operatorMapJson: channelDraft.dingtalk.operatorMapJson.trim(), eventTypes: channelDraft.dingtalk.eventTypes },
          wecom: { webhookUrl: channelDraft.wecom.webhookUrl.trim(), callbackToken: channelDraft.wecom.callbackToken.trim(), operatorMapJson: channelDraft.wecom.operatorMapJson.trim(), eventTypes: channelDraft.wecom.eventTypes },
        })}
        isSaving={saveAutoDirectorChannelsMutation.isPending}
      />
    </>;
  }
}
