//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\convert\pdf.controller.ts

import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { ConvertService } from './convert.service';

@Controller('convert')
export class PdfController {
  constructor(private readonly convertService: ConvertService) {}

  @Post('pdf-to-word')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  @Header('Content-Disposition', 'attachment; filename="resultado.docx"')
  async pdfToWord(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StreamableFile> {
    if (!file) throw new BadRequestException('Falta el archivo');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Debe ser un PDF');
    }
    const stream = await this.convertService.pdfToDocx(file.buffer);
    return new StreamableFile(stream);
  }
}
