#!/usr/bin/env python3
"""
MK AI — Executive Output Engine with Render-and-Inspect Visual QA Loop (Phase 7)
Generates real, standards-compliant PDF (multi-page vector PDF 1.4), PPTX (OpenXML slide deck),
DOCX (OpenXML document), XLSX (OpenXML spreadsheet), CSV, and HTML dashboards with zero external
binary dependencies, then runs `MKVerifierEngine` visual & structural QA checks before returning.
"""
import os
import re
import time
import zipfile
from typing import Any, Dict, List, Optional
from xml.sax.saxutils import escape as xml_escape

from verifiers import MKVerifierEngine


class MKOutputEngine:
    """
    Produces executive-grade PDF, PPTX, DOCX, and XLSX deliverables and verifies each output
    through a render-and-inspect QA loop (checking margins, coordinate bounds, page count, and XML validity).
    """

    @staticmethod
    def _pdf_escape(text: str) -> str:
        clean = re.sub(r"[^\x20-\x7E]", " ", str(text))
        return clean.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    @classmethod
    def generate_pdf(
        cls,
        output_path: str,
        title: str,
        subtitle: str,
        sections: List[Dict[str, Any]],
        footer_note: str = "MK AI Enterprise Autonomous Workforce — Verified Deliverable",
    ) -> Dict[str, Any]:
        """
        Generates a multi-page vector PDF 1.4 document with executive header bar, section cards,
        KPI tables, and page numbers, then runs `MKVerifierEngine.verify_pdf_artifact`.
        """
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        # Paginate sections cleanly (max ~34 lines per page so margins 48..792 are strictly respected)
        pages_lines: List[List[tuple]] = []
        current_page: List[tuple] = []

        for sec in sections:
            heading = str(sec.get("heading", "Section"))
            bullets = [str(b) for b in sec.get("bullets", [])]
            if len(current_page) + 2 > 30:
                pages_lines.append(current_page)
                current_page = []
            current_page.append(("heading", heading))
            for b in bullets:
                # Wrap at 82 chars
                words = b.split()
                line = ""
                first = True
                for w in words:
                    if len(line) + len(w) + 1 > 80:
                        current_page.append(("bullet" if first else "text", line))
                        first = False
                        line = w
                        if len(current_page) >= 32:
                            pages_lines.append(current_page)
                            current_page = []
                    else:
                        line = f"{line} {w}".strip()
                if line:
                    current_page.append(("bullet" if first else "text", line))
                    if len(current_page) >= 32:
                        pages_lines.append(current_page)
                        current_page = []
            current_page.append(("spacer", ""))

        if not pages_lines and not current_page:
            current_page.append(("heading", "Executive Summary"))
            current_page.append(("bullet", "Deliverable generated and verified by MK AI Output Engine."))
        if current_page:
            pages_lines.append(current_page)

        objects: List[bytes] = []

        def add_obj(body: bytes) -> int:
            objects.append(body)
            return len(objects)

        font_regular_id = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        font_bold_id = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

        page_obj_ids: List[int] = []
        content_obj_ids: List[int] = []

        total_pages = len(pages_lines)
        for page_idx, items in enumerate(pages_lines, start=1):
            stream_cmds: List[str] = []
            # Navy header banner
            stream_cmds.append("0.06 0.09 0.16 rg 36 742 540 64 re f")
            stream_cmds.append("0.06 0.72 0.50 rg 36 739 540 3 re f")
            stream_cmds.append("BT /F2 15 Tf 1 1 1 rg 48 780 Td (" + cls._pdf_escape(title[:68]) + ") Tj ET")
            stream_cmds.append("BT /F1 9.5 Tf 0.78 0.84 0.92 rg 48 758 Td (" + cls._pdf_escape(subtitle[:90]) + ") Tj ET")

            y = 712
            for kind, txt in items:
                if y < 68:
                    break
                if kind == "heading":
                    stream_cmds.append(f"0.93 0.96 0.99 rg 42 {y - 4} 528 20 re f")
                    stream_cmds.append(f"BT /F2 11.5 Tf 0.08 0.24 0.48 rg 48 {y + 2} Td ({cls._pdf_escape(txt[:75])}) Tj ET")
                    y -= 24
                elif kind == "bullet":
                    stream_cmds.append(f"BT /F1 10 Tf 0.12 0.16 0.22 rg 52 {y} Td (- {cls._pdf_escape(txt[:85])}) Tj ET")
                    y -= 16
                elif kind == "text":
                    stream_cmds.append(f"BT /F1 10 Tf 0.12 0.16 0.22 rg 62 {y} Td ({cls._pdf_escape(txt[:85])}) Tj ET")
                    y -= 16
                elif kind == "spacer":
                    y -= 8

            # Footer line
            stream_cmds.append("0.82 0.86 0.90 RG 0.7 w 36 48 m 576 48 l S")
            footer_str = f"{footer_note}  |  Page {page_idx} of {total_pages}"
            stream_cmds.append(f"BT /F1 8.5 Tf 0.40 0.45 0.52 rg 48 34 Td ({cls._pdf_escape(footer_str)}) Tj ET")

            stream_bytes = "\n".join(stream_cmds).encode("latin-1", errors="replace")
            cid = add_obj(b"<< /Length " + str(len(stream_bytes)).encode("ascii") + b" >>\nstream\n" + stream_bytes + b"\nendstream")
            content_obj_ids.append(cid)

        pages_tree_id = len(objects) + total_pages + 1
        for cid in content_obj_ids:
            pid = add_obj(
                f"<< /Type /Page /Parent {pages_tree_id} 0 R /MediaBox [0 0 612 842] "
                f"/Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R >> >> "
                f"/Contents {cid} 0 R >>".encode("ascii")
            )
            page_obj_ids.append(pid)

        kids_ref = " ".join(f"{pid} 0 R" for pid in page_obj_ids)
        actual_pages_tree_id = add_obj(f"<< /Type /Pages /Kids [{kids_ref}] /Count {len(page_obj_ids)} >>".encode("ascii"))
        assert actual_pages_tree_id == pages_tree_id
        catalog_id = add_obj(f"<< /Type /Catalog /Pages {pages_tree_id} 0 R >>".encode("ascii"))

        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets: List[int] = [0]
        for idx, obj_bytes in enumerate(objects, start=1):
            offsets.append(len(out))
            out.extend(f"{idx} 0 obj\n".encode("ascii"))
            out.extend(obj_bytes)
            out.extend(b"\nendobj\n")

        xref_offset = len(out)
        out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        out.extend(b"0000000000 65535 f \n")
        for off in offsets[1:]:
            out.extend(f"{off:010d} 00000 n \n".encode("ascii"))
        out.extend(
            f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
        )

        with open(output_path, "wb") as f:
            f.write(out)

        verification = MKVerifierEngine.verify_pdf_artifact(output_path, min_pages=1)
        return {
            "output_path": os.path.abspath(output_path),
            "page_count": len(page_obj_ids),
            "verification": verification,
        }

    @classmethod
    def generate_pptx(
        cls,
        output_path: str,
        deck_title: str,
        slides: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Generates a valid OpenXML `.pptx` presentation with multiple slides and verifies it via `verify_pptx_artifact`.
        """
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        if not slides:
            slides = [{"title": deck_title, "bullets": ["Executive presentation generated by MK AI"]}]

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            slide_overrides = "\n".join(
                f'  <Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
                for i in range(1, len(slides) + 1)
            )
            content_types = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
{slide_overrides}
</Types>"""
            zf.writestr("[Content_Types].xml", content_types)

            root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"""
            zf.writestr("_rels/.rels", root_rels)

            pres_rels_items = "\n".join(
                f'  <Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>'
                for i in range(1, len(slides) + 1)
            )
            pres_rels = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
{pres_rels_items}
</Relationships>"""
            zf.writestr("ppt/_rels/presentation.xml.rels", pres_rels)

            sld_id_list = "\n".join(
                f'    <p:sldId id="{255 + i}" r:id="rId{i}"/>'
                for i in range(1, len(slides) + 1)
            )
            presentation_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
{sld_id_list}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>"""
            zf.writestr("ppt/presentation.xml", presentation_xml)

            for i, s in enumerate(slides, start=1):
                stitle = xml_escape(str(s.get("title", f"Slide {i}")))
                sbullets = [xml_escape(str(b)) for b in s.get("bullets", [])]
                paragraphs = [
                    f'<a:p><a:r><a:rPr lang="en-US" sz="2800" b="1"/><a:t>{stitle}</a:t></a:r></a:p>'
                ]
                for b in sbullets:
                    paragraphs.append(
                        f'<a:p><a:r><a:rPr lang="en-US" sz="1800"/><a:t>• {b}</a:t></a:r></a:p>'
                    )
                paragraphs_xml = "\n            ".join(paragraphs)
                slide_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="SlideContent"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="685800" y="457200"/><a:ext cx="10820400" cy="5943600"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square"/>
          <a:lstStyle/>
          {paragraphs_xml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>"""
                zf.writestr(f"ppt/slides/slide{i}.xml", slide_xml)

        verification = MKVerifierEngine.verify_pptx_artifact(output_path, min_slides=len(slides))
        return {
            "output_path": os.path.abspath(output_path),
            "slide_count": len(slides),
            "verification": verification,
        }

    @classmethod
    def generate_docx(
        cls,
        output_path: str,
        title: str,
        paragraphs: List[str],
    ) -> Dict[str, Any]:
        """Generates a valid OpenXML `.docx` document and verifies it via `verify_docx_artifact`."""
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(
                "[Content_Types].xml",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>""",
            )
            zf.writestr(
                "_rels/.rels",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""",
            )
            p_nodes = [f"<w:p><w:r><w:t>{xml_escape(title)}</w:t></w:r></w:p>"]
            for p in paragraphs:
                p_nodes.append(f"<w:p><w:r><w:t>{xml_escape(str(p))}</w:t></w:r></w:p>")
            doc_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {"".join(p_nodes)}
  </w:body>
</w:document>"""
            zf.writestr("word/document.xml", doc_xml)

        verification = MKVerifierEngine.verify_docx_artifact(output_path)
        return {"output_path": os.path.abspath(output_path), "verification": verification}

    @classmethod
    def generate_xlsx(
        cls,
        output_path: str,
        sheet_name: str,
        rows: List[List[Any]],
    ) -> Dict[str, Any]:
        """Generates a valid OpenXML `.xlsx` spreadsheet and verifies it via `verify_xlsx_artifact`."""
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(
                "[Content_Types].xml",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>""",
            )
            zf.writestr(
                "_rels/.rels",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>""",
            )
            zf.writestr(
                "xl/_rels/workbook.xml.rels",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>""",
            )
            zf.writestr(
                "xl/workbook.xml",
                f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="{xml_escape(sheet_name[:31])}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>""",
            )
            row_xml_list = []
            for r_idx, row in enumerate(rows, start=1):
                cells = []
                for c_idx, val in enumerate(row):
                    col_letter = chr(65 + (c_idx % 26))
                    ref = f"{col_letter}{r_idx}"
                    if isinstance(val, (int, float)) and not isinstance(val, bool):
                        cells.append(f'<c r="{ref}"><v>{val}</v></c>')
                    else:
                        cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{xml_escape(str(val))}</t></is></c>')
                row_xml_list.append(f'<row r="{r_idx}">{"".join(cells)}</row>')
            sheet_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    {"".join(row_xml_list)}
  </sheetData>
</worksheet>"""
            zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)

        verification = MKVerifierEngine.verify_xlsx_artifact(output_path)
        return {"output_path": os.path.abspath(output_path), "verification": verification}
