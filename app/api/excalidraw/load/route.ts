import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing 'projectId' query param" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        id: project.id,
        title: project.name,
        data: project.excalidrawScene ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[excalidraw/load]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}