import { AccountSettings } from "@/components/account/AccountSettings";
import { LabelsSettings } from "@/components/settings/LabelsSettings";
import { GithubSettings } from "@/components/settings/GithubSettings";
import { TrashSettings } from "@/components/settings/TrashSettings";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";

export function SettingsPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-8">
      <div className="flex items-center gap-1">
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <CopyLinkButton />
      </div>
      <AccountSettings />
      <LabelsSettings />
      <GithubSettings />
      <TrashSettings />
    </div>
  );
}
