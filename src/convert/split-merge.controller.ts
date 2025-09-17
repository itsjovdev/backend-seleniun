// src/convert/split-merge.controller.ts
import { Controller, Post, UploadedFile, UploadedFiles, UseInterceptors, BadRequestException, StreamableFile, Res, Body } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Express, Response } from 'express';
import { ConvertService } from './convert.service';

@Controller('convert')
export class SplitMergeController {
  constructor(private readonly convertService: ConvertService) {}

  @Post('split-pdf')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async splitPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('pages') pages: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!file) throw new BadRequestException('Falta el archivo PDF');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Debe ser un archivo PDF');
    }
    if (!pages || !pages.trim()) {
      throw new BadRequestException('Debe especificar las páginas a extraer');
    }

    const stream = await this.convertService.splitPdf(file.buffer, pages.trim(), file.originalname);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalname.replace('.pdf', '')}_dividido.pdf"`);
    
    return new StreamableFile(stream);
  }

  @Post('merge-pdf')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 100 * 1024 * 1024 } }))
  async mergePdfs(
    @UploadedFiles() files: Express.Multer.File[],
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!files || files.length < 2) {
      throw new BadRequestException('Debe proporcionar al menos 2 archivos PDF');
    }

    const nonPdfFiles = files.filter(f => f.mimetype !== 'application/pdf');
    if (nonPdfFiles.length > 0) {
      throw new BadRequestException('Todos los archivos deben ser PDFs');
    }

    const buffers = files.map(f => f.buffer);
    const filenames = files.map(f => f.originalname);
    
    const stream = await this.convertService.mergePdfs(buffers, filenames);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento_unido.pdf"');
    
    return new StreamableFile(stream);
  }
}