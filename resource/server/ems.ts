import { ems, online } from "@aicore-fivem/lib/server";
import { settings } from "./panel";

/** Medics free to take a call: an EMS script's own count (busy ones left out), else ai-core's duty counts. */
export const emsAvailable = (): number => ems.available(settings.value.emsJobs);
export const isEms = (source: number): boolean =>
  online.onDutyIn(source, settings.value.emsJobs);
