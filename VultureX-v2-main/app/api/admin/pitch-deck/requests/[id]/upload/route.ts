import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pitchDeckEvents, pitchDeckFiles, pitchDeckRequests } from "@/db/schema";
import { formatBytes, requireAdmin, validateDeckFile } from "@/features/pitch-deck";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * POST — admin uploads a prepared pitch deck (PDF/PPTX).
 * The upload is private until the admin explicitly publishes it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [record] = await db
    .select()
    .from(pitchDeckRequests)
    .where(eq(pitchDeckRequests.id, id))
    .limit(1);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (record.status === "completed") {
    return NextResponse.json(
      { error: "This request is already completed. The founder must request a revision first." },
      { status: 409 },
    );
  }
  if (record.status === "rejected") {
    return NextResponse.json(
      { error: "This request was rejected. The founder must reopen it before a deck can be uploaded." },
      { status: 409 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }

  const invalid = validateDeckFile({ name: file.name, type: file.type, size: file.size });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  const [stored] = await db
    .insert(pitchDeckFiles)
    .values({
      requestId: record.id,
      startupId: record.startupId,
      kind: "deck",
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      content: buffer,
      uploadedBy: admin.userId,
      isPublished: false,
    })
    .returning({ id: pitchDeckFiles.id, fileName: pitchDeckFiles.fileName, sizeBytes: pitchDeckFiles.sizeBytes });

  // Uploading moves the request into preparation; it never publishes.
  if (record.status === "approved") {
    await db
      .update(pitchDeckRequests)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(pitchDeckRequests.id, record.id));
  } else {
    await db
      .update(pitchDeckRequests)
      .set({ updatedAt: new Date() })
      .where(eq(pitchDeckRequests.id, record.id));
  }

  await db.insert(pitchDeckEvents).values({
    requestId: record.id,
    actorId: admin.userId,
    actorRole: "admin",
    type: "deck_uploaded",
    message: `Draft uploaded: ${file.name} (${formatBytes(file.size)}) — not published`,
  });

  return NextResponse.json({ file: stored, published: false });
}
