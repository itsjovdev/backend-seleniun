import {   
  Controller,   
  Post,   
  UploadedFile,   
  UploadedFiles,   // ← AGREGADO para múltiples archivos
  UseInterceptors,   
  BadRequestException,   
  StreamableFile,   
  Res,
  Body    // ← AGREGADO para recibir el campo 'pages'
} from '@nestjs/common'; 
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'; // ← AGREGADO FilesInterceptor
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
    res.setHeader('X-Compression-Engine', String(engine));       
    return new StreamableFile(stream);   
  }

  // ← AQUÍ VAN TUS NUEVOS MÉTODOS
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

    // Validar que todos sean PDFs
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