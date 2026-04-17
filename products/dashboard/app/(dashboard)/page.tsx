import { HelloWorldCard } from "@/components/hello-world-card";
import { ShellEvents } from "@/components/shell-events";

export default function HomePage() {
  return (
    <>
      {/* Emits dashboard.shell_viewed on mount */}
      <ShellEvents route="/" />

      <div className="max-w-2xl">
        <HelloWorldCard />
      </div>
    </>
  );
}
