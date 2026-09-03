import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ComponentCapability, ComponentCategory } from "@/components/component-capability";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import type { ComponentDefinition } from "@/components/component-definition";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/state/store";
import { TscircuitSymbolAdapter } from "@/tscircuit/tscircuit-symbol-adapter";

enum PaletteText {
  SearchLabel = "Search components",
  SearchPlaceholder = "Search all components",
  AllCategories = "All components",
  EmptyResults = "No components match this search.",
  BenchUnavailableReason = "This component is not available in the guided hands-on bench workflow.",
  SpiceUnavailableReason = "No verified SPICE model is available for this component.",
  DesignDescription = "Can be added and edited on the design board.",
  SpiceDescription = "Can participate in SPICE circuit simulation.",
  BenchDescription = "Can be used in the guided hands-on bench workflow.",
  AddHint = "Click to add at the next open position, or drag a component onto the board.",
  CapabilityLegend = "Capability legend",
  ShowMore = "Show more",
  ShowLess = "Show less"
}

enum CapabilityLabel {
  Design = "Design",
  Spice = "SPICE",
  Bench = "Bench"
}

enum CapabilityStateText {
  Supported = "supported",
  Unavailable = "unavailable"
}

const categoryOrder: readonly ComponentCategory[] = [
  ComponentCategory.Power,
  ComponentCategory.Passive,
  ComponentCategory.Semiconductor,
  ComponentCategory.Control,
  ComponentCategory.IntegratedCircuit
];

const categoryLabels: Readonly<Record<ComponentCategory, string>> = {
  [ComponentCategory.Power]: "Power",
  [ComponentCategory.Passive]: "Passives",
  [ComponentCategory.Semiconductor]: "Semiconductors",
  [ComponentCategory.Control]: "Controls",
  [ComponentCategory.IntegratedCircuit]: "Integrated circuits"
};

const capabilityLabels: Readonly<Record<ComponentCapability, CapabilityLabel>> = {
  [ComponentCapability.Design]: CapabilityLabel.Design,
  [ComponentCapability.Spice]: CapabilityLabel.Spice,
  [ComponentCapability.Bench]: CapabilityLabel.Bench
};

const capabilityDescriptions: Readonly<Record<ComponentCapability, PaletteText>> = {
  [ComponentCapability.Design]: PaletteText.DesignDescription,
  [ComponentCapability.Spice]: PaletteText.SpiceDescription,
  [ComponentCapability.Bench]: PaletteText.BenchDescription
};

const unavailableCapabilityDescriptions: Readonly<Record<ComponentCapability, PaletteText>> = {
  [ComponentCapability.Design]: PaletteText.DesignDescription,
  [ComponentCapability.Spice]: PaletteText.SpiceUnavailableReason,
  [ComponentCapability.Bench]: PaletteText.BenchUnavailableReason
};

const capabilities: readonly ComponentCapability[] = [
  ComponentCapability.Design,
  ComponentCapability.Spice,
  ComponentCapability.Bench
];

const compactGroupLimit = 4;

function CapabilityBadge({ capability, definition }: { capability: ComponentCapability; definition: ComponentDefinition }) {
  const supported = definition.capabilities.has(capability);
  const label = capabilityLabels[capability];
  const description = supported ? capabilityDescriptions[capability] : unavailableCapabilityDescriptions[capability];
  const state = supported ? CapabilityStateText.Supported : CapabilityStateText.Unavailable;

  return (
    <span
      className={cn("palette-capability", !supported && "unavailable")}
      aria-label={`${label} ${state}${supported ? "" : `: ${description}`}`}
      title={`${label} ${state}. ${description}`}
    >
      {label} {supported ? "✓" : "—"}
    </span>
  );
}

function PaletteRow({ definition, count }: { definition: ComponentDefinition; count: number }) {
  const add = useStudioStore((state) => state.addComponent);

  return (
    <button
      type="button"
      draggable
      aria-label={`Add ${definition.name}`}
      onDragStart={(event) => event.dataTransfer.setData("application/x-probepilot-component", definition.kind)}
      onClick={() => add(definition.kind, { x: 90 + (count % 4) * 190, y: 120 + Math.floor(count / 4) * 135 }, { actor: "human" })}
      className="group w-full rounded-md border border-border/80 bg-background/40 p-2 text-left transition hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-10 shrink-0 place-items-center rounded border border-border bg-muted px-1">
          {TscircuitSymbolAdapter.render(definition.symbolName, { className: "h-6 w-8" })}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold">{definition.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{definition.description}</span>
        </span>
      </span>
      <span className="ml-12 mt-1 flex flex-wrap gap-1" aria-label={`${definition.name} capabilities`}>
        {capabilities.map((capability) => <CapabilityBadge key={capability} capability={capability} definition={definition} />)}
      </span>
    </button>
  );
}

export function ComponentPalette() {
  const count = useStudioStore((state) => Object.keys(state.design.components).length);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ComponentCategory | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<ReadonlySet<ComponentCategory>>(new Set());
  const definitions = ComponentDefinitionRegistry.list();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredDefinitions = useMemo(() => definitions.filter((definition) => {
    const inCategory = category === null || definition.category === category;
    const searchable = `${definition.name} ${definition.description} ${definition.kind}`.toLowerCase();
    return inCategory && searchable.includes(normalizedQuery);
  }), [category, definitions, normalizedQuery]);

  const toggleCategoryExpansion = (selectedCategory: ComponentCategory) => {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(selectedCategory)) next.delete(selectedCategory);
      else next.add(selectedCategory);
      return next;
    });
  };

  return (
    <div className="component-palette-scroll flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-card/95 px-4 pb-3 pt-4 shadow-sm backdrop-blur">
        <div className="flex items-baseline justify-between gap-2">
          <div><h2 className="panel-heading">Catalog</h2><p className="mt-1 text-xs text-muted-foreground"><span className="mono font-semibold text-foreground">{count} placed</span> · {definitions.length} catalog entries</p></div>
        </div>
        <Input type="search" aria-label={PaletteText.SearchLabel} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={PaletteText.SearchPlaceholder} />
        <div className="flex flex-wrap gap-1" aria-label="Component category filters">
          <button type="button" onClick={() => setCategory(null)} aria-pressed={category === null} className={cn("palette-filter", category === null && "active")}>{PaletteText.AllCategories}</button>
          {categoryOrder.map((item) => {
            const label = categoryLabels[item];
            const itemCount = ComponentDefinitionRegistry.byCategory(item).length;
            return <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={cn("palette-filter", category === item && "active")}>{label} <span className="mono">{itemCount}</span></button>;
          })}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {categoryOrder.map((item) => {
          const group = filteredDefinitions.filter((definition) => definition.category === item);
          if (group.length === 0) return null;
          const expanded = category === item || normalizedQuery.length > 0 || expandedCategories.has(item);
          const visible = expanded ? group : group.slice(0, compactGroupLimit);
          const remaining = group.length - visible.length;
          const label = categoryLabels[item];
          return (
            <section key={item} aria-labelledby={`category-${item}`}>
              <div className="mb-2 flex items-center justify-between gap-2"><h3 id={`category-${item}`} className="panel-heading">{label}</h3><span className="mono text-[10px] text-muted-foreground">{group.length}</span></div>
              <div className="space-y-1.5">{visible.map((definition) => <PaletteRow key={definition.kind} definition={definition} count={count} />)}</div>
              {group.length > compactGroupLimit && normalizedQuery.length === 0 && category === null && <button type="button" className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline" onClick={() => toggleCategoryExpansion(item)}>{expanded ? PaletteText.ShowLess : `${PaletteText.ShowMore} (${remaining})`}</button>}
            </section>
          );
        })}
        {filteredDefinitions.length === 0 && <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">{PaletteText.EmptyResults}</p>}
        <aside aria-label={PaletteText.CapabilityLegend} className="rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Design</strong> adds and edits components; <strong className="text-foreground">SPICE</strong> marks verified local ngspice support; <strong className="text-foreground">Bench</strong> marks guided hands-on workflow support. Bench — means {PaletteText.BenchUnavailableReason.toLowerCase()}
        </aside>
        <p className="pb-1 text-xs leading-relaxed text-muted-foreground">{PaletteText.AddHint}</p>
      </div>
    </div>
  );
}
