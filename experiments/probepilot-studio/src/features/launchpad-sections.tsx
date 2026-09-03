import { ArrowRight, Bot, CheckCircle2, Eye, FlaskConical, Gauge, LockKeyhole, MousePointer2, Plus, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LaunchpadSectionsProps {
  readonly onOpenDemo: () => void;
  readonly onOpenBlank: () => void;
}

const workflow = [
  { icon: Wrench, number: "01", title: "Design", body: "Place components, connect semantic terminals, edit values, and protect elements from agent changes." },
  { icon: Gauge, number: "02", title: "Simulate", body: "Validate the circuit and inspect current, voltage drop, warnings, and the visible LED state." },
  { icon: FlaskConical, number: "03", title: "Diagnose", body: "Move to the faulty virtual bench. The agent requests evidence; you operate the meter." },
  { icon: CheckCircle2, number: "04", title: "Verify", body: "Review the evidence-backed repair, approve it yourself, and compare the result with the design." }
];

const tools = ["studio_inspect", "design_build_circuit", "design_update_components", "design_remove_elements", "design_validate_and_simulate", "bench_request_measurement", "bench_update_hypotheses", "bench_stage_repair", "bench_verify"];

const questions = [
  { question: "Where are my projects stored?", answer: "In your browser’s local storage. ProbePilot sends no project data to an account or server." },
  { question: "What does a project file contain?", answer: "The project name, circuit design, revision, and newest 100 public activity entries. It excludes active bench sessions and hidden faults." },
  { question: "Can an import overwrite my work?", answer: "No. Every import receives a new local ID. ProbePilot adjusts duplicate names without replacing an existing project." },
  { question: "Why does the agent ask me for measurements?", answer: "ProbePilot gives the meter to the human. The agent can request a reading and reason from the evidence, but it cannot manufacture the result." },
  { question: "Do I need WebMCP to use the studio?", answer: "No. You can build, simulate, and operate the bench manually. WebMCP adds structured agent collaboration in supported browsers." },
  { question: "Does this replace professional circuit software?", answer: "No. ProbePilot is a focused low-voltage collaboration demo, not an ECAD, SPICE, PCB, or safety-critical engineering tool." }
];

export function LaunchpadSections({ onOpenDemo, onOpenBlank }: LaunchpadSectionsProps) {
  return <>
    <section className="launch-reveal mx-auto max-w-6xl px-6 py-20">
      <p className="panel-heading text-primary">THE COMPLETE LOOP</p><h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">From circuit idea to verified repair</h2><p className="mt-4 max-w-2xl text-muted-foreground">The design and the bench share one visible circuit, but they enforce different rules.</p>
      <div className="mt-12 grid border-y border-border md:grid-cols-2 lg:grid-cols-4">{workflow.map((step, index) => <article key={step.number} className={`py-7 md:px-6 ${index > 0 ? "border-t border-border md:border-t-0" : ""} ${index % 2 ? "md:border-l" : ""} ${index > 1 ? "lg:border-l" : ""}`}><div className="flex items-center justify-between"><step.icon className="h-5 w-5 text-primary"/><span className="mono text-xs text-muted-foreground">{step.number}</span></div><h3 className="mt-7 text-lg font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p></article>)}</div>
    </section>

    <section className="launch-reveal border-y border-border bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
        <div><p className="panel-heading text-primary">EVIDENCE BEFORE ACTION</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The human stays in the measurement loop</h2><p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">The application separates agent reasoning from physical-style evidence. Code enforces the boundary at every step.</p></div>
        <div className="divide-y divide-border border-y border-border">
          <div className="grid gap-3 py-6 sm:grid-cols-[140px_1fr]"><span className="flex items-center gap-2 text-sm font-semibold"><Bot className="h-4 w-4 text-primary"/>Agent</span><p className="text-sm leading-relaxed text-muted-foreground">Inspects the public circuit, changes editable design elements, requests exact test points, updates hypotheses, and stages a repair.</p></div>
          <div className="grid gap-3 py-6 sm:grid-cols-[140px_1fr]"><span className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-primary"/>Human</span><p className="text-sm leading-relaxed text-muted-foreground">Creates the bench, operates the meter, reviews the cited evidence, and chooses whether to apply the repair.</p></div>
          <div className="grid gap-3 py-6 sm:grid-cols-[140px_1fr]"><span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary"/>Application</span><p className="text-sm leading-relaxed text-muted-foreground">Hides the fault, rejects unsupported actions, requires two human measurements, and verifies the repaired output.</p></div>
        </div>
      </div>
    </section>

    <section className="launch-reveal mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[.8fr_1.2fr]">
      <div><p className="panel-heading text-primary">STRUCTURED WEBMCP</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Nine tools, one controlled workspace</h2><p className="mt-5 leading-relaxed text-muted-foreground">The agent works through narrow circuit and bench commands. It does not need a generic DOM-clicking or JavaScript tool.</p><div className="mt-7 flex items-center gap-5 text-sm"><span className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary"/>Public state only</span><span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-primary"/>Private fault</span></div></div>
      <ol className="divide-y divide-border border-y border-border">{tools.map((tool, index) => <li key={tool} className="flex items-center gap-4 py-3"><span className="mono w-6 text-[10px] text-primary">{String(index + 1).padStart(2, "0")}</span><code className="mono text-xs sm:text-sm">{tool}</code></li>)}</ol>
    </section>

    <section className="launch-reveal border-y border-border bg-muted/35">
      <div className="mx-auto max-w-6xl px-6 py-20"><p className="panel-heading text-primary">FAQ</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Questions before you start</h2><div className="mt-10 divide-y divide-border border-y border-border">{questions.map((item) => <details key={item.question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium"><span>{item.question}</span><Plus className="h-4 w-4 shrink-0 transition-transform group-open:rotate-45"/></summary><p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{item.answer}</p></details>)}</div></div>
    </section>

    <section className="launch-reveal mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-20 sm:flex-row sm:items-end"><div><p className="panel-heading text-primary">OPEN THE WORKSPACE</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Start with a proven circuit or an empty board.</h2></div><div className="flex flex-wrap gap-3"><Button size="lg" onClick={onOpenDemo}>Open deterministic demo<ArrowRight className="h-4 w-4"/></Button><Button size="lg" variant="outline" onClick={onOpenBlank}><MousePointer2 className="h-4 w-4"/>Blank circuit</Button></div></section>
  </>;
}
