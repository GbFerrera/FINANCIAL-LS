import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        updatedAt: true,
        excalidrawScene: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const mapped = items.map((p) => ({
      id: p.id,
      title: p.name,
      updatedAt: p.updatedAt,
      hasScene: p.excalidrawScene != null,
    }));

    return NextResponse.json(mapped, { status: 200 });
  } catch (error) {
    console.error("[excalidraw/list]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}