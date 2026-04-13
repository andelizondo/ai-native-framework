import { ShellEvents } from "@/components/shell-events";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PenLine } from "lucide-react";

export default function DesignPage() {
  return (
    <>
      <ShellEvents route="/design" />

      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <PenLine className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Design</CardTitle>
                <CardDescription>
                  Spec system, requirements, system design, and event catalog
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              This phase produces a schema-valid product spec, a stubbed event catalog, and an
              observability plan. Exit criteria: a spec that passes{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono">
                npm run validate
              </code>{" "}
              and an approved design brief.
            </p>
            <p className="mt-3 text-sm text-slate-400 italic">
              Slice implementation coming in a future sprint.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
