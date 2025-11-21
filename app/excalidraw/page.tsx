"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const ExcalidrawClient = dynamic(() => import("@/components/ExcalidrawClient"), {
  ssr: false,
});

function ExcalidrawPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId") ?? undefined;
  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <ExcalidrawClient initialLoadId={projectId} />
    </div>
  );
}

export default function Page() {
  return (
    <div style={{ height: "100vh", width: "100vw", minHeight: 0 }}>
      <Suspense fallback={<div style={{ padding: 16 }}>Carregando…</div>}>
        <ExcalidrawPageContent />
      </Suspense>
    </div>
  );
}