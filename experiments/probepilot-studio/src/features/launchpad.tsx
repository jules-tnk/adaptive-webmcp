import { ArrowRight, Bot, CircuitBoard, FlaskConical, Plus, ShieldCheck, Wrench } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBlankDesign, createDemoDesign } from "@/domain/fixtures";
import { LaunchpadSections } from "@/features/launchpad-sections";
import { ProjectLibrary } from "@/projects/project-library";
import { projectRepository } from "@/projects/project-runtime";
import type { ProjectRecord } from "@/projects/project-types";
import { studioStore } from "@/state/store";
import { ThemeToggle } from "@/theme/theme-toggle";

export function Launchpad() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openProject = (project: ProjectRecord): void => {
    studioStore.getState().loadProject(project);
    navigate(`/studio/${project.id}`);
  };
  const openDemo = (): void => openProject(projectRepository.create(createDemoDesign(), []));
  const openBlank = (): void => openProject(projectRepository.create(createBlankDesign(), []));

  return <div className="min-h-full overflow-hidden bg-[radial-gradient(circle_at_50%_-12%,hsl(var(--primary)/.14),transparent_34%)]">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Wrench className="h-5 w-5"/></div><div><div className="font-bold">ProbePilot Studio</div><div className="text-xs text-muted-foreground">Human-agent circuit design and diagnosis</div></div></div>
      <div className="flex items-center gap-2"><Badge variant="outline" className="hidden sm:inline-flex"><Bot className="mr-1 h-3 w-3"/>WebMCP Challenge build</Badge><ThemeToggle /></div>
    </header>

    {searchParams.get("notice") === "project-not-found" && <div role="status" className="mx-auto max-w-6xl px-6"><div className="border-l-2 border-primary bg-primary/5 px-4 py-3 text-sm">That project could not be found in this browser. Open another project or create a new one.</div></div>}
    <main>
      <section className="launch-reveal mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
        <div><Badge>DESIGN → BENCH → EVIDENCE → REPAIR</Badge><h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Design the ideal circuit. Diagnose the imperfect one.</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">Build a circuit with an agent, simulate the design, then diagnose a faulty virtual bench from measurements you perform.</p><div className="mt-8 flex flex-wrap gap-3"><Button size="lg" onClick={openDemo}>Open deterministic demo<ArrowRight className="h-4 w-4"/></Button><Button size="lg" variant="outline" onClick={openBlank}><Plus className="h-4 w-4"/>Blank circuit</Button></div></div>
        <Card className="overflow-hidden border-primary/25 bg-card/85 shadow-instrument"><CardHeader><div className="flex items-center justify-between"><CardTitle>Switched status LED</CardTitle><Badge variant="success">READY</Badge></div><CardDescription>A complete judging path with a deterministic hidden bench fault.</CardDescription></CardHeader><CardContent><div className="space-y-3"><div className="flex gap-3 border-t border-border py-3"><CircuitBoard className="mt-0.5 h-4 w-4 text-primary"/><div><p className="text-sm font-medium">Build and simulate</p><p className="text-xs text-muted-foreground">Five semantic components with exact terminal IDs.</p></div></div><div className="flex gap-3 border-t border-border py-3"><FlaskConical className="mt-0.5 h-4 w-4 text-primary"/><div><p className="text-sm font-medium">Create a faulty bench</p><p className="text-xs text-muted-foreground">The fault stays outside page state and project files.</p></div></div><div className="flex gap-3 border-y border-border py-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-primary"/><div><p className="text-sm font-medium">Keep the human in control</p><p className="text-xs text-muted-foreground">Only you take measurements and approve repairs.</p></div></div></div></CardContent></Card>
      </section>

      <ProjectLibrary repository={projectRepository} onOpen={openProject} />
      <LaunchpadSections onOpenDemo={openDemo} onOpenBlank={openBlank} />
    </main>
  </div>;
}
