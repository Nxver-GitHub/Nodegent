/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assignments from "../assignments.js";
import type * as auditLog from "../auditLog.js";
import type * as canvas from "../canvas.js";
import type * as chat from "../chat.js";
import type * as courseListings from "../courseListings.js";
import type * as courseNotes from "../courseNotes.js";
import type * as courses from "../courses.js";
import type * as dockApps from "../dockApps.js";
import type * as events from "../events.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as mcpConnectors from "../mcpConnectors.js";
import type * as mcpTools from "../mcpTools.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignments: typeof assignments;
  auditLog: typeof auditLog;
  canvas: typeof canvas;
  chat: typeof chat;
  courseListings: typeof courseListings;
  courseNotes: typeof courseNotes;
  courses: typeof courses;
  dockApps: typeof dockApps;
  events: typeof events;
  googleCalendar: typeof googleCalendar;
  mcpConnectors: typeof mcpConnectors;
  mcpTools: typeof mcpTools;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
