import { BLIP_STYLE_FIELDS } from "@aicore-fivem/lib/shared";
import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

export const hospitalsFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: {
    label: "",
    respawn: { x: 0, y: 0, z: 0, heading: 0 },
    checkin: { x: 0, y: 0, z: 0 },
    blip: true,
    blipStyle: { sprite: 61, color: 1, scale: 0.7 },
  },
  sections: {
    label: { type: "text", min: 1, max: 48 },
    respawn: { type: "vec4" },
    checkin: { type: "vec3" },
    blip: { type: "bool" },
    blipStyle: {
      type: "object",
      optional: true,
      fields: BLIP_STYLE_FIELDS,
    },
  },
};

export const hospitalsTab: TabSpec = {
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
        {
          widget: "blip",
          path: "blipStyle",
          label: "ADMIN_F_BLIP_STYLE",
          showIf: { path: "blip", values: [true] },
        },
      ],
    },
  ],
};
