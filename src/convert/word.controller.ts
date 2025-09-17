//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\convert\word.controller.ts

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
export class WordController {
  constructor(private readonly convertService: ConvertService) {}

  @Post('word-to-pdf')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="resultado.pdf"')
  async wordToPdf(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StreamableFile> {
    if (!file) throw new BadRequestException('Falta el archivo');

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Debe ser un archivo Word (.doc o .docx)');
    }

    const stream = await this.convertService.wordToPdf(file.buffer, file.originalname);
    return new StreamableFile(stream);
  }
}