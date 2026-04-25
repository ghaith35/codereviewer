import { pdf } from "@react-pdf/renderer";
import type { ReactElement } from "react";

export async function downloadPDF(doc: ReactElement, filename: string) {
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(window.document.createElement("a"), {
    href: url,
    download: filename,
  });
  anchor.click();
  URL.revokeObjectURL(url);
}
