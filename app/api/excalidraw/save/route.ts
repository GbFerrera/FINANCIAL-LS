import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, data } = body ?? {};

    if (!data) {
      return NextResponse.json({ error: "Missing 'data' in body" }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: "Missing 'projectId' in body" }, { status: 400 });
    }

    // Evita erro de tipo em cenários onde o Client não refletiu o campo ainda
    const updateData: any = { excalidrawScene: data };
    let project;
    try {
      project = await prisma.project.update({
        where: { id: projectId },
        data: updateData,
      });
    } catch (e) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        id: project.id,
        title: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[excalidraw/save]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}