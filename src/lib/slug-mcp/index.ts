import { searchClasses, type SearchClassesArgs } from "./search-classes";
import { getDiningMenu, type GetDiningMenuArgs } from "./get-dining-menu";
import { searchDirectory, type SearchDirectoryArgs } from "./search-directory";

export const MCP_TOOL_NAMES = [
  "search_classes",
  "get_dining_menu",
  "search_directory",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

const MCP_TOOL_NAMES_SET = new Set<string>(MCP_TOOL_NAMES);

export function isMcpTool(name: string): name is McpToolName {
  return MCP_TOOL_NAMES_SET.has(name);
}

export async function dispatchMcpTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  if (!isMcpTool(toolName)) throw new Error(`Unknown MCP tool: ${toolName}`);
  switch (toolName) {
    case "search_classes":
      return searchClasses(args as unknown as SearchClassesArgs);
    case "get_dining_menu":
      return getDiningMenu(args as unknown as GetDiningMenuArgs);
    case "search_directory":
      return searchDirectory(args as unknown as SearchDirectoryArgs);
  }
}

// OpenAI function-spec definitions — used in the MCP call route for validation
export const MCP_TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "search_classes",
      description:
        "Search UCSC class schedule on pisa.ucsc.edu. Use for questions about courses, " +
        "enrollment, instructors, meeting times, or available sections. " +
        "Term codes: Spring 2026=2262, Summer 2026=2264, Fall 2026=2268. " +
        "Use dept codes like CSE, MATH, PHYS, CMPM. " +
        "'Next quarter' from June 2026 means Fall 2026 (2268).",
      parameters: {
        type: "object",
        properties: {
          term: { type: "string", description: "Term code e.g. 2268 for Fall 2026" },
          subject: { type: "string", description: "Dept code e.g. CSE, MATH, PHYS" },
          course_number: { type: "string", description: "Course number e.g. 115A" },
          instructor: { type: "string", description: "Instructor last name" },
          title: { type: "string", description: "Course title keyword" },
          open_only: { type: "boolean", description: "Only show open/available sections" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dining_menu",
      description:
        "Get today's UCSC dining hall menu from nutrition.sa.ucsc.edu. " +
        "Halls: cowell/stevenson, crown/merrill, porter/kresge, carson/oakes, lewis/college-nine. " +
        "Meals: Breakfast, Lunch, Dinner.",
      parameters: {
        type: "object",
        properties: {
          hall: {
            type: "string",
            description: "Dining hall alias e.g. 'cowell', 'porter', 'lewis', 'crown', 'carson'",
          },
          meal: {
            type: "string",
            description: "Meal period: Breakfast, Lunch, or Dinner",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_directory",
      description:
        "Search UCSC campus directory for faculty, staff, or departments. " +
        "Use for finding instructor contact info, office locations, or department listings.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name, department, or keyword to search" },
          type: {
            type: "string",
            enum: ["people", "departments"],
            description: "Search type (default: people)",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
] as const;
