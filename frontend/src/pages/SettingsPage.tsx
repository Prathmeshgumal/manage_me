import { AccountSettings } from "@/components/account/AccountSettings";
import { GithubSettings } from "@/components/settings/GithubSettings";

export function SettingsPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-8">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <AccountSettings />
      <GithubSettings />
    </div>
  );
}
