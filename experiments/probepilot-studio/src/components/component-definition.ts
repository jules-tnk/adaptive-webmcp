import type { z } from "zod";
import type { ComponentCategory, ComponentCapability } from "./component-capability";
import type { PropertyFieldDefinition } from "./property-field-definition";
import type { ComponentKindValue, ComponentProperties, ComponentPropertyInput } from "@/domain/types";
import { TerminalSide } from "@/domain/types";
import type { TscircuitSymbolName } from "@/tscircuit/tscircuit-symbol-name";

export { TerminalSide } from "@/domain/types";

export type TerminalDefinition = {
  id: string;
  label: string;
  symbolPortAlias: string;
  side: TerminalSide;
  offset: number;
};

export type ComponentDefinition = {
  readonly kind: ComponentKindValue;
  readonly name: string;
  readonly category: ComponentCategory;
  readonly prefix: string;
  readonly symbolName: TscircuitSymbolName;
  readonly description: string;
  readonly terminals: readonly TerminalDefinition[];
  readonly propertySchema: z.ZodType<ComponentProperties, z.ZodTypeDef, ComponentPropertyInput>;
  readonly propertyFields: readonly PropertyFieldDefinition[];
  readonly defaultProperties: ComponentProperties;
  readonly defaultFootprint: string;
  readonly capabilities: ReadonlySet<ComponentCapability>;
};
