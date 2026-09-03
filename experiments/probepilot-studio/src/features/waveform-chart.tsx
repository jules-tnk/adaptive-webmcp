import type { SimulationWaveform } from "@/domain/types";

interface WaveformChartProps { readonly waveform: SimulationWaveform; }

export function WaveformChart({ waveform }: WaveformChartProps) {
  const width = 480;
  const height = 120;
  const padding = 14;
  const xs = waveform.points.map((point) => point.x);
  const ys = waveform.points.map((point) => point.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const path = waveform.points.map((point, index) => {
    const x = padding + ((point.x - minX) / rangeX) * (width - padding * 2);
    const y = height - padding - ((point.y - minY) / rangeY) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  return <figure className="min-w-0">
    <figcaption className="mb-2 text-xs font-semibold">{waveform.label}</figcaption>
    <svg role="img" aria-label={`${waveform.label} waveform`} viewBox={`0 0 ${width} ${height}`} className="h-28 w-full rounded-md border border-border bg-background/60">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="hsl(var(--border))" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="hsl(var(--border))" />
      <path data-testid="waveform-path" d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="sr-only">
      <table aria-label={`${waveform.label} values`}><thead><tr><th>Point</th><th>X</th><th>Y</th></tr></thead><tbody>{waveform.points.map((point, index) => <tr key={`${point.x}:${index}`}><td>{index + 1}</td><td>{point.x}</td><td>{point.y}</td></tr>)}</tbody></table>
    </div>
  </figure>;
}
