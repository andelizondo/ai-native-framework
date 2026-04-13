import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

export function HelloWorldCard() {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Hello, World</CardTitle>
            <CardDescription>
              AI-Native Dashboard · Shell v0.1
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm leading-relaxed text-slate-600">
          The framework shell is running. Left navigation, top bar, and event
          emission are all wired. Use the sidebar to explore the three product
          phases, or extend this card with your first real slice.
        </p>

        {/* Phase summary */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Ideation", href: "/ideation", color: "bg-amber-50 text-amber-700 border-amber-100" },
            { label: "Design", href: "/design", color: "bg-blue-50 text-blue-700 border-blue-100" },
            { label: "Implementation", href: "/implementation", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
          ].map(({ label, href, color }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-medium transition-opacity hover:opacity-80 ${color}`}
            >
              {label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      </CardContent>

      <CardFooter className="border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          Spec:{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">
            spec/examples/dashboard-product.yaml
          </code>
          {" · "}
          Events: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">dashboard.shell_viewed</code>
        </p>
      </CardFooter>
    </Card>
  );
}
