import { ShellEvents } from "@/components/shell-events";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

export default function IdeationPage() {
  return (
    <>
      <ShellEvents route="/ideation" />

      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <Lightbulb className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Ideation</CardTitle>
                <CardDescription>
                  Problem definition, user goals, constraints, and success metrics
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              This phase captures the problem space, the target user, and the bounded scope
              needed before design begins. Exit criteria: a defined success metric and a
              bounded scope.
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
