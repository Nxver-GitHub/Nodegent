"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id } from "@convex/_generated/dataModel";
import { Plugs } from "@phosphor-icons/react";

const TOOL_LABELS: Record<string, string> = {
  search_classes: "Class search (pisa.ucsc.edu)",
  get_dining_menu: "Dining menus (nutrition.sa.ucsc.edu)",
  search_directory: "Campus directory (campusdirectory.ucsc.edu)",
};

export function ConnectorsPanel({ onClose }: { onClose: () => void }) {
  const connectors = useQuery(api.mcpConnectors.list);
  const ensureBuiltin = useMutation(api.mcpConnectors.ensureUcscBuiltin);
  const setEnabled = useMutation(api.mcpConnectors.setEnabled);

  // Seed the UCSC built-in if it doesn't exist yet
  useEffect(() => {
    ensureBuiltin();
  }, [ensureBuiltin]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">AI Connectors</h2>
          <p className="mt-1 text-sm text-gray-600">
            Connect external data sources so the AI assistant can query live campus info.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        {connectors === undefined && (
          <p className="text-sm text-gray-400">Loading connectors…</p>
        )}
        {connectors?.map((connector) => (
          <div
            key={connector._id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Plugs size={20} className="text-blue-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {connector.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {connector.type === "builtin" ? "Built-in" : "HTTP connector"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={connector.enabled}
                onClick={() =>
                  setEnabled({ id: connector._id as Id<"mcpConnectors">, enabled: !connector.enabled })
                }
                className={[
                  "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2",
                  "border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  "focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  connector.enabled ? "bg-blue-600" : "bg-gray-200",
                ].join(" ")}
              >
                <span
                  className={[
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full",
                    "bg-white shadow ring-0 transition duration-200 ease-in-out",
                    connector.enabled ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>

            {connector.enabled && connector.tools.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                {connector.tools.map((tool) => (
                  <li key={tool} className="text-xs text-gray-600">
                    <span className="mr-1 text-green-500">✓</span>
                    {TOOL_LABELS[tool] ?? tool}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {/* v2 placeholder */}
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
          <p className="text-sm text-gray-400">Custom HTTP connectors — coming soon</p>
        </div>
      </div>
    </div>
  );
}
