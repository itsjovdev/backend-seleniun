//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\pdf-encrypt\pdf-encrypt.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  InternalServerErrorException,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PdfEncryptService } from './pdf-encrypt.service';

// DTO para validar el request
class EncryptPdfDto {
  password: string;
}

@Controller('pdf-encrypt')
export class PdfEncryptController {
  constructor(private readonly pdfEncryptService: PdfEncryptService) {}

  @Post('encrypt')
  @UseInterceptors(
    FileInterceptor('pdf', {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB máximo
      },
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async encryptPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: EncryptPdfDto,
    @Res() res: Response,
  ) {
    try {
      // Validaciones
      if (!file) {
        throw new BadRequestException('No PDF file provided');
      }

      if (!body.password || body.password.length < 4) {
        throw new BadRequestException(
          'Password must be at least 4 characters long',
        );
      }

      // Generar ID único para tracking
      const jobId = uuidv4();
      const { password } = body;

      console.log(
        `[${jobId}] Starting PDF encryption - File: ${file.originalname} (${file.size} bytes)`,
      );

      // Procesar encriptación usando el servicio
      const encryptedBuffer = await this.pdfEncryptService.encryptPdf(
        file.buffer,
        password,
        jobId,
      );

      // Preparar nombre del archivo
      const originalName = file.originalname.replace(/\.pdf$/i, '');
      const encryptedFilename = `${originalName}_encrypted.pdf`;

      console.log(
        `[${jobId}] Encryption completed - Output: ${encryptedBuffer.length} bytes`,
      );

      // Configurar headers para descarga
      res.setHeader(
        'Content-Type',
        'application/pdf',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encryptedFilename}"`,
      );
      res.setHeader('Content-Length', encryptedBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      // Enviar el PDF encriptado
      return res.status(HttpStatus.OK).send(encryptedBuffer);

    } catch (error) {
      console.error('PDF encryption error:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `PDF encryption failed: ${error.message}`,
      );
    }
  }

  @Post('encrypt-json')
  @UseInterceptors(
    FileInterceptor('pdf', {
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async encryptPdfJson(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: EncryptPdfDto,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No PDF file provided');
      }

      if (!body.password || body.password.length < 4) {
        throw new BadRequestException(
          'Password must be at least 4 characters long',
        );
      }

      const jobId = uuidv4();
      const { password } = body;

      console.log(
        `[${jobId}] Starting PDF encryption (JSON response) - File: ${file.originalname}`,
      );

      const encryptedBuffer = await this.pdfEncryptService.encryptPdf(
        file.buffer,
        password,
        jobId,
      );

      const originalName = file.originalname.replace(/\.pdf$/i, '');
      const encryptedFilename = `${originalName}_encrypted.pdf`;

      // Devolver como JSON con el archivo en base64
      return {
        success: true,
        message: 'PDF encrypted successfully',
        filename: encryptedFilename,
        originalSize: file.size,
        encryptedSize: encryptedBuffer.length,
        data: encryptedBuffer.toString('base64'),
        jobId,
      };

    } catch (error) {
      console.error('PDF encryption error:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `PDF encryption failed: ${error.message}`,
      );
    }
  }

  // Endpoint de health check
  @Post('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'PDF Encryption Service',
      timestamp: new Date().toISOString(),
      info: this.pdfEncryptService.getServiceInfo(),
    };
  }
}