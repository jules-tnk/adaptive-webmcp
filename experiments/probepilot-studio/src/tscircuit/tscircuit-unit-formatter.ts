import { formatSiUnit } from "format-si-unit";

export class TscircuitUnitFormatter {
  static format(value: number): string {
    return formatSiUnit(value);
  }
}
