"use client";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const ExcalidrawClient = dynamic(() => import("@/components/ExcalidrawClient"), {
  ssr: false,
});

export default function Page() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId") ?? undefined;
  return (
    <div style={{ height: "100vh" }}>
      <ExcalidrawClient initialLoadId={projectId} />
    </div>
  );
}