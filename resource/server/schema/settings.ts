import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

const money = {
  type: "number",
  min: 0,
  max: 1_000_000,
  integer: true,
} as const;
const names = {
  type: "names",
  max: 10,
  itemMax: 32,
  pattern: "^[a-z0-9_]{2,32}$",
} as const;

export const settingsFile: FileSpec = {
  kind: "settings",
  sync: "all",
  sections: {
    respawnSeconds: { type: "number", min: 0, max: 3600, integer: true },
    respawnFee: money,
    accounts: { ...names, max: 5 },
    clearInventory: { type: "bool" },
    emsJobs: names,
    treatPrice: money,
    treatMaxEms: { type: "number", min: 0, max: 100, integer: true },
    healthRegen: { type: "bool" },
    reviveFee: { ...money, optional: true },
    distressCooldown: {
      type: "number",
      min: 10,
      max: 3600,
      integer: true,
      optional: true,
    },
  },
};

export const settingsTab: TabSpec = {
  id: "settings",
  file: "settings",
  icon: "heart-pulse",
  label: "ADMIN_TAB_SETTINGS",
  desc: "ADMIN_TAB_SETTINGS_DESC",
  cards: [
    {
      icon: "heart-pulse",
      title: "ADMIN_C_RESPAWN",
      desc: "ADMIN_C_RESPAWN_DESC",
      fields: [
        {
          widget: "number",
          path: "respawnSeconds",
          label: "ADMIN_F_RESPAWN_TIME",
          hint: "ADMIN_H_RESPAWN_TIME",
          min: 0,
          max: 3600,
          step: 30,
          unit: "s",
        },
        {
          widget: "number",
          path: "respawnFee",
          label: "ADMIN_F_RESPAWN_FEE",
          hint: "ADMIN_H_RESPAWN_FEE",
          min: 0,
          max: 1_000_000,
          step: 100,
          unit: "$",
        },
        {
          widget: "switch",
          path: "clearInventory",
          label: "ADMIN_F_CLEAR",
          hint: "ADMIN_H_CLEAR",
        },
        {
          widget: "switch",
          path: "healthRegen",
          label: "ADMIN_F_HEALTH_REGEN",
          hint: "ADMIN_H_HEALTH_REGEN",
        },
        {
          widget: "tags",
          lookup: "account",
          path: "accounts",
          label: "ADMIN_F_ACCOUNTS",
          hint: "ADMIN_H_ACCOUNTS",
          placeholder: "ADMIN_P_ACCOUNTS",
        },
      ],
    },
    {
      icon: "user",
      title: "ADMIN_C_MEDICS",
      desc: "ADMIN_C_MEDICS_DESC",
      fields: [
        {
          widget: "tags",
          lookup: "job",
          path: "emsJobs",
          label: "ADMIN_F_EMS_JOBS",
          hint: "ADMIN_H_EMS_JOBS",
          placeholder: "ADMIN_P_EMS_JOBS",
        },
        {
          widget: "number",
          path: "treatPrice",
          label: "ADMIN_F_TREAT_PRICE",
          hint: "ADMIN_H_TREAT_PRICE",
          min: 0,
          max: 1_000_000,
          step: 50,
          unit: "$",
        },
        {
          widget: "number",
          path: "treatMaxEms",
          label: "ADMIN_F_TREAT_MAX",
          hint: "ADMIN_H_TREAT_MAX",
          min: 0,
          max: 100,
        },
        {
          widget: "number",
          path: "reviveFee",
          label: "ADMIN_F_REVIVE_FEE",
          hint: "ADMIN_H_REVIVE_FEE",
          min: 0,
          max: 1_000_000,
          step: 50,
          unit: "$",
        },
        {
          widget: "number",
          path: "distressCooldown",
          label: "ADMIN_F_DISTRESS_COOLDOWN",
          hint: "ADMIN_H_DISTRESS_COOLDOWN",
          min: 10,
          max: 3600,
          step: 10,
          unit: "s",
        },
      ],
    },
  ],
};
