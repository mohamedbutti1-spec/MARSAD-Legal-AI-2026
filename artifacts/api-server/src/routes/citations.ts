import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import { GenerateCitationBody } from "@workspace/api-zod";
import { requireAnyRole } from "../middlewares/roleAuth";

const router: IRouter = Router();

// POST /citations
router.post("/citations", requireAnyRole, async (req, res): Promise<void> => {
  const parsed = GenerateCitationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { documentId, authorName, publicationYear, publisher, url } = parsed.data;

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, documentId));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const year = publicationYear || new Date().getFullYear();
  const author = authorName || "Unknown Author";
  const pub = publisher || "Unknown Publisher";
  const title = doc.originalName.replace(/\.[^.]+$/, ""); // strip extension

  // Harvard citation format: Author (Year) Title. Publisher. URL (if available)
  let citation = `${author} (${year}) '${title}'`;
  if (pub !== "Unknown Publisher") {
    citation += `, ${pub}`;
  }
  citation += ".";
  if (url) {
    citation += ` Available at: ${url} (Accessed: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}).`;
  }

  req.log.info({ documentId, citationFormat: "Harvard" }, "Citation generated");
  res.json({
    citation,
    format: "Harvard",
  });
});

export default router;
