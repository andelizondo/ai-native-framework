import { ShellEvents } from "@/components/shell-events";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Code2 } from "lucide-react";

export default function ImplementationPage() {
  return (
    <>
      <ShellEvents route="/implementation" />

      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Code2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Implementation</CardTitle>
                <CardDescription>
                  Vertical slices: UI + API + persistence + telemetry in one increment
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Each implementation slice ships UI, API, data persistence, and telemetry together.
              Exit criteria: deployed, observable, and spec updated with implemented facts.
            </p>
            <p className="mt-3 text-sm text-slate-600 italic">
              Slice implementation coming in a future sprint.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
