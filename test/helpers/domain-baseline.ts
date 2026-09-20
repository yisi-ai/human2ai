import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import baselines from "../../governance/baselines.json" with { type: "json" };

interface Capability {
  id: string;
  consumers: string[];
  implementations: Array<{ role: string; path: string; consumer?: string }>;
}

export function registeredCapability(id: string): Capability {
  const location = baselines.baselines.find((entry) => entry.id === "domain")!.location;
  const registry = JSON.parse(readFileSync(resolve(location, "registry.json"), "utf8")) as {
    capabilities: Capability[];
  };
  const capability = registry.capabilities.find((entry) => entry.id === id);
  if (!capability) throw new Error(`Missing domain capability: ${id}`);
  return capability;
}
