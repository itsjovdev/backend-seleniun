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
  constructor(private readonly convertService: ConvertService) {
    console.log('🚀 PdfController initialized');
  }

  @Post('pdf-to-word')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  @Header('Content-Disposition', 'attachment; filename="resultado.docx"')
  async pdfToWord(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StreamableFile> {
    console.log('📥 POST /convert/pdf-to-word called');
    console.log('📁 File received:', file ? file.originalname : 'NO FILE');
    
    if (!file) {
      console.log('❌ No file uploaded');
      throw new BadRequestException('Falta el archivo');
    }
    
    if (file.mimetype !== 'application/pdf') {
      console.log('❌ Wrong file type:', file.mimetype);
      throw new BadRequestException('Debe ser un PDF');
    }

    console.log('✅ Starting conversion for:', file.originalname);
    
    try {
      const stream = await this.convertService.pdfToDocx(file.buffer);
      console.log('✅ Conversion successful');
      return new StreamableFile(stream);
    } catch (error: any) {
      console.error('❌ Conversion failed:', error.message);
      throw new BadRequestException(`Error de conversión: ${error.message}`);
    }
  }
}