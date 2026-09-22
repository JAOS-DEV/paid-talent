"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { JOB_ROLE_OPTIONS, OTHER_JOB_ROLE } from "@/lib/profile/job-roles";
import {
  JOB_ROLE_MESSAGE_KEYS,
  translateCatalogValue,
} from "@/lib/i18n/labels";
import {
  CUSTOM_JOB_ROLE_MAX_LENGTH,
  MAX_JOB_ROLES,
} from "@/lib/profile/limits";
import { Input } from "@/components/ui";

interface JobRolesPickerProps {
  predefined: string[];
  otherSelected: boolean;
  customRole: string;
  onPredefinedChange: (roles: string[]) => void;
  onOtherSelectedChange: (selected: boolean) => void;
  onCustomRoleChange: (value: string) => void;
  error?: string | null;
}

export function JobRolesPicker({
  predefined,
  otherSelected,
  customRole,
  onPredefinedChange,
  onOtherSelectedChange,
  onCustomRoleChange,
  error,
}: JobRolesPickerProps): React.ReactElement {
  const t = useTranslations("roles");
  const profile = useTranslations("worker.profile");
  const selectedCount =
    predefined.length + (otherSelected && customRole.trim() ? 1 : 0);

  function toggleRole(role: string): void {
    if (role === OTHER_JOB_ROLE) {
      if (!otherSelected && predefined.length >= MAX_JOB_ROLES) {
        return;
      }
      onOtherSelectedChange(!otherSelected);
      if (otherSelected) {
        onCustomRoleChange("");
      }
      return;
    }

    if (predefined.includes(role)) {
      onPredefinedChange(predefined.filter((item) => item !== role));
      return;
    }

    if (selectedCount >= MAX_JOB_ROLES) {
      return;
    }

    onPredefinedChange([...predefined, role]);
  }

  function isSelected(role: string): boolean {
    if (role === OTHER_JOB_ROLE) {
      return otherSelected;
    }
    return predefined.includes(role);
  }

  return (
    <div>
      <p className="text-charcoal-400 text-sm mb-4">
        {profile("selectRoles")}
      </p>
      <div className="flex flex-wrap gap-2">
        {JOB_ROLE_OPTIONS.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => toggleRole(role)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px]
              ${
                isSelected(role)
                  ? "bg-primary-600 text-white"
                  : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
              }
            `}
          >
            {translateCatalogValue(t, JOB_ROLE_MESSAGE_KEYS, role)}
          </button>
        ))}
      </div>
      {otherSelected ? (
        <div className="mt-4">
          <Input
            label={profile("otherRoleLabel")}
            placeholder={profile("otherRolePlaceholder")}
            value={customRole}
            maxLength={CUSTOM_JOB_ROLE_MAX_LENGTH}
            onChange={(event) => onCustomRoleChange(event.target.value)}
          />
          <p className="text-charcoal-500 text-xs mt-1.5">
            {customRole.length}/{CUSTOM_JOB_ROLE_MAX_LENGTH}
          </p>
        </div>
      ) : null}
      {error ? <p className="text-error text-sm mt-3">{error}</p> : null}
    </div>
  );
}
