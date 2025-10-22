import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { convertFileSrc } from '@tauri-apps/api/core';
import './PdfViewer.css';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import React, { lazy, useRef, useState } from 'react';
import { useContainerSize } from '../../hooks/useContainerQuery';

const Document = lazy(() => import('react-pdf').then((m) => ({ default: m.Document })));
const Page = lazy(() => import('react-pdf').then((m) => ({ default: m.Page })));

import('react-pdf').then(({ pdfjs }) => {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
});

interface Props {
  bodyPath: string;
}

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
};

export function PdfViewer({ bodyPath }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>();

  const { width: containerWidth } = useContainerSize(containerRef);

  const onDocumentLoadSuccess = ({ numPages: nextNumPages }: PDFDocumentProxy): void => {
    setNumPages(nextNumPages);
  };

  const src = convertFileSrc(bodyPath);
  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto">
      <Document
        file={src}
        options={options}
        onLoadSuccess={onDocumentLoadSuccess}
        externalLinkTarget="_blank"
        externalLinkRel="noopener noreferrer"
      >
        {Array.from(new Array(numPages), (_, index) => (
          <Page
            className="mb-6 select-all"
            renderTextLayer
            renderAnnotationLayer
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            width={containerWidth}
          />
        ))}
      </Document>
    </div>
  );
}
