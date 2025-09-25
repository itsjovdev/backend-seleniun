// src/pdf/pdf.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PdfService, SummarizeMode, ReturnFormat } from './pdf.service';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * POST /pdf/summarize
   * Form-data: file=<PDF>
   * Query:
   *  - mode: 'executive' | 'rich' (default: 'executive')
   *  - format: 'markdown' | 'json+markdown' (default: 'markdown')
   *  - targetWordsPerChunk: number (default: 800)
   *  - chunkOverlapSentences: number (default: 2)
   */
  @Post('summarize')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 60 * 1024 * 1024 } }))
  async summarize(
    @UploadedFile() file?: Express.Multer.File,
    @Query('mode') mode?: SummarizeMode,
    @Query('format') format?: ReturnFormat,
    @Query('targetWordsPerChunk') targetWordsPerChunk?: string,
    @Query('chunkOverlapSentences') chunkOverlapSentences?: string,
  ) {
    if (!file) throw new BadRequestException('Sube un archivo PDF en el campo "file".');

    const opts = {
      mode: (mode === 'rich' ? 'rich' : 'executive') as SummarizeMode,
      returnFormat: (format === 'json+markdown' ? 'json+markdown' : 'markdown') as ReturnFormat,
      targetWordsPerChunk: Number(targetWordsPerChunk ?? 800),
      chunkOverlapSentences: Number(chunkOverlapSentences ?? 2),
    };

    try {
      return await this.pdfService.summarizePdf(file.buffer, opts);
    } catch (e: any) {
      // Logs útiles en servidor
      // eslint-disable-next-line no-console
      console.error('❌ summarize error:', e?.message, e?.response?.status, e?.response?.data);

      const msg = e?.message ?? 'Fallo al resumir el PDF';

      if (msg.includes('No se pudo extraer texto')) {
        throw new BadRequestException(msg); // PDF escaneado sin OCR
      }

      if (e?.response?.status === 401) {
        throw new BadRequestException('Ollama/HF_TOKEN inválido o faltante.');
      }

      if (e?.response?.status === 400 || e?.response?.status === 413) {
        const payloadMsg = typeof e?.response?.data === 'string'
          ? e.response.data
          : 'El texto es demasiado largo para el modelo.';
        throw new BadRequestException(payloadMsg);
      }

      throw new HttpException({ message: msg }, 500);
    }
  }
}
