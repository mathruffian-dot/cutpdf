
import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';

// This is a dynamic import, so we declare the type to be available later.
// It will be loaded from a CDN at runtime.
declare let PDFLib: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  pdfFile = signal<File | null>(null);
  totalPages = signal(0);
  startPage = signal(1);
  endPage = signal(1);
  
  isProcessing = signal(false);
  errorMessage = signal('');
  croppedPdfUrl = signal<string | null>(null);
  
  // Dynamically load pdf-lib when needed
  private async getPdfLib() {
    if (typeof PDFLib === 'undefined') {
      // A simple way to load a script dynamically.
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    return PDFLib;
  }

  isFormValid = computed(() => {
    const start = this.startPage();
    const end = this.endPage();
    const total = this.totalPages();
    return start > 0 && end >= start && end <= total && total > 0;
  });
  
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (file.type !== 'application/pdf') {
      this.errorMessage.set('請上傳一個 PDF 檔案。');
      return;
    }
    
    this.resetState();
    this.pdfFile.set(file);
    this.isProcessing.set(true);
    this.errorMessage.set('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { PDFDocument } = await this.getPdfLib();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPageCount();
      this.totalPages.set(pages);
      this.startPage.set(1);
      this.endPage.set(pages);
    } catch (e) {
      console.error(e);
      this.errorMessage.set('讀取 PDF 失敗。檔案可能已損壞。');
      this.resetState();
    } finally {
      this.isProcessing.set(false);
    }
  }

  updateStartPage(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.startPage.set(parseInt(value, 10) || 1);
    this.croppedPdfUrl.set(null);
  }

  updateEndPage(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.endPage.set(parseInt(value, 10) || 1);
    this.croppedPdfUrl.set(null);
  }

  async cropPdf(): Promise<void> {
    if (!this.pdfFile() || !this.isFormValid()) {
      return;
    }

    this.isProcessing.set(true);
    this.errorMessage.set('');
    this.croppedPdfUrl.set(null);

    try {
      const file = this.pdfFile()!;
      const arrayBuffer = await file.arrayBuffer();
      const { PDFDocument } = await this.getPdfLib();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const newPdfDoc = await PDFDocument.create();
      const start = this.startPage() - 1;
      const end = this.endPage();

      const pageIndices = Array.from({ length: end - start }, (_, i) => start + i);
      
      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach(page => newPdfDoc.addPage(page));
      
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Revoke previous URL if it exists
      const currentUrl = this.croppedPdfUrl();
      if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
      }

      const url = URL.createObjectURL(blob);
      this.croppedPdfUrl.set(url);

    } catch (e) {
      console.error(e);
      this.errorMessage.set('裁切 PDF 時發生錯誤。');
    } finally {
      this.isProcessing.set(false);
    }
  }

  resetFile(): void {
    this.resetState();
    // Also reset the file input visually
    const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }
  }

  private resetState(): void {
    this.pdfFile.set(null);
    this.totalPages.set(0);
    this.startPage.set(1);
    this.endPage.set(1);
    this.isProcessing.set(false);
    this.errorMessage.set('');
    
    const currentUrl = this.croppedPdfUrl();
    if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
    }
    this.croppedPdfUrl.set(null);
  }

  getFileName(): string {
    return this.pdfFile()?.name ?? 'unknown.pdf';
  }
}
