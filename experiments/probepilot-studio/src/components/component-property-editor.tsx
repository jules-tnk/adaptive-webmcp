import { useEffect, useState } from "react";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import {
  PropertyFieldControl,
  PropertyFieldDefinitions,
  PropertyFieldKey,
  type PropertyFieldDefinition
} from "@/components/property-field-definition";
import { Input } from "@/components/ui/input";
import type { ComponentPropertyPatch } from "@/domain/catalog";
import type { CircuitComponent, CommandResult } from "@/domain/types";

export type ComponentPropertyEditorProps = {
  readonly component: CircuitComponent;
  readonly onUpdateProperties: (patch: ComponentPropertyPatch) => CommandResult<CircuitComponent>;
};

export function ComponentPropertyEditor({ component, onUpdateProperties }: ComponentPropertyEditorProps) {
  const definition = ComponentDefinitionRegistry.get(component.kind);
  const editablePropertyFingerprint = definition.propertyFields
    .filter((field) => field.control !== PropertyFieldControl.Readonly)
    .map((field) => `${field.key}:${String(PropertyFieldDefinitions.value(component.properties, field.key))}`)
    .join("|");
  const [error, setError] = useState<string | null>(null);
  const [draftComponentId, setDraftComponentId] = useState(component.id);
  const [draftValues, setDraftValues] = useState<Partial<Record<PropertyFieldKey, string>>>({});

  useEffect(() => {
    setDraftComponentId(component.id);
    setDraftValues({});
    setError(null);
  }, [component.id, editablePropertyFingerprint]);

  const commit = (field: PropertyFieldDefinition, value: string | boolean): void => {
    const normalizedValue = typeof value === "string" && value.trim() !== "" && field.control === PropertyFieldControl.Number && !field.acceptsSiUnit
      ? Number(value)
      : value;
    const result = onUpdateProperties({ [field.key]: normalizedValue });
    setDraftValues((current) => {
      const next = { ...current };
      delete next[field.key];
      return next;
    });
    setError(result.ok ? null : result.error.message);
  };

  const propertyValue = (field: PropertyFieldDefinition): string | number | boolean => {
    if (field.control === PropertyFieldControl.Readonly) {
      return field.key === PropertyFieldKey.Footprint ? definition.defaultFootprint : field.staticValue ?? "";
    }
    return PropertyFieldDefinitions.value(component.properties, field.key);
  };

  return <div className="space-y-4">
    {definition.propertyFields.map((field) => {
      const value = propertyValue(field);
      if (field.control === PropertyFieldControl.Boolean) {
        return <label key={field.key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
          <span>{field.label}</span>
          <input aria-label={field.label} type="checkbox" checked={value === true} onChange={(event) => commit(field, event.currentTarget.checked)} />
        </label>;
      }
      if (field.control === PropertyFieldControl.Select) {
        return <label key={field.key} className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">{field.label}</span>
          <select aria-label={field.label} className="flex h-9 w-full rounded-md border border-input bg-background/70 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={String(value)} onChange={(event) => commit(field, event.currentTarget.value)}>
            {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>;
      }
      if (field.control === PropertyFieldControl.Readonly) {
        return <div key={field.key} className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="text-[11px] font-medium text-muted-foreground">{field.label}</div>
          <output className="mono text-sm">{String(value)}</output>
        </div>;
      }
      const numericValue = PropertyFieldDefinitions.numberValue(component.properties, field.key);
      const draftValue = draftComponentId === component.id ? draftValues[field.key] : undefined;
      return <label key={field.key} className="block">
        <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">{field.label}</span>
        <Input aria-label={field.label} type={field.acceptsSiUnit ? "text" : "number"} inputMode="decimal" step="any" value={draftValue ?? PropertyFieldDefinitions.inputValue(numericValue, field)} onChange={(event) => { const nextValue = event.currentTarget.value; setDraftValues((current) => ({ ...current, [field.key]: nextValue })); }} onBlur={(event) => commit(field, event.currentTarget.value)} />
        <span className="mt-1 block text-[10px] text-muted-foreground">Normalized: {PropertyFieldDefinitions.normalizedSummary(numericValue, field.unit, field.displaysPercentage)}</span>
      </label>;
    })}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
