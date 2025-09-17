import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Response } from 'express';
import { ConvertService } from './convert.service';

@Controller('convert')
export class CompressPdfController {
  constructor(private readonly convertService: ConvertService) {}

  @Post('compress-pdf')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  async compressPdf(
    @UploadedFile() file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!file) throw new BadRequestException('Falta el archivo');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Debe ser un PDF');
    }

const { stream, originalSize, compressedSize, reduction, engine } =
  await this.convertService.compressPdf(file.buffer, file.originalname);

res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', 'attachment; filename="compressed.pdf"');
res.setHeader('X-Original-Size', String(originalSize));
res.setHeader('X-Compressed-Size', String(compressedSize));
res.setHeader('X-Reduction-Percent', String(reduction));
res.setHeader('X-Compression-Engine', String(engine)); // ⬅️ nuevo


    return new StreamableFile(stream);
  }
}
