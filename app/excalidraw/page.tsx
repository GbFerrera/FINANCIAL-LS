import dynamic from "next/dynamic";

const ExcalidrawClient = dynamic(() => import("@/components/ExcalidrawClient"), {
  ssr: false,
});

export default function Page({ searchParams }: { searchParams?: { projectId?: string } }) {
  const projectId = searchParams?.projectId;
  return (
    <div style={{ height: "100vh" }}>
      <ExcalidrawClient initialLoadId={projectId} />
    </div>
  );
}