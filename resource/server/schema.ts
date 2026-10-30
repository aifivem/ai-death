import type { PanelSchema } from "@aicore-fivem/shared";

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

/** ai-death's panel: respawn rules, treatment, medics and the hospitals. */
export const deathSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "heart-pulse",
  files: {
    settings: {
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
      },
    },
    hospitals: {
      kind: "records",
      sync: "all",
      labelPath: "label",
      newRecord: {
        label: "",
        respawn: { x: 0, y: 0, z: 0, heading: 0 },
        checkin: { x: 0, y: 0, z: 0 },
        blip: true,
      },
      sections: {
        label: { type: "text", min: 1, max: 48 },
        respawn: { type: "vec4" },
        checkin: { type: "vec3" },
        blip: { type: "bool" },
      },
    },
  },
  tabs: [
    {
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
          ],
        },
      ],
    },
    {
      id: "hospitals",
      file: "hospitals",
      icon: "location-dot",
      label: "ADMIN_TAB_HOSPITALS",
      desc: "ADMIN_TAB_HOSPITALS_DESC",
      createLabel: "ADMIN_NEW_HOSPITAL",
      deleteLabel: "ADMIN_DELETE_HOSPITAL",
      cards: [
        {
          icon: "location-dot",
          title: "ADMIN_C_HOSPITAL",
          desc: "ADMIN_C_HOSPITAL_DESC",
          fields: [
            {
              widget: "text",
              path: "label",
              suggest: { from: "respawn" },
              label: "ADMIN_F_LABEL",
              placeholder: "ADMIN_P_LABEL",
            },
            {
              widget: "point",
              path: "respawn",
              label: "ADMIN_F_RESPAWN",
              hint: "ADMIN_H_RESPAWN",
              heading: true,
              ground: true,
            },
            {
              widget: "point",
              path: "checkin",
              label: "ADMIN_F_CHECKIN",
              hint: "ADMIN_H_CHECKIN",
              ground: true,
            },
            { widget: "switch", path: "blip", label: "ADMIN_F_BLIP" },
          ],
        },
      ],
    },
  ],
};
