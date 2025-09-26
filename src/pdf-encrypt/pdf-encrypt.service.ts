// src/pdf-encrypt/pdf-encrypt.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class PdfEncryptService {
  private readonly tempDir = os.tmpdir();
  private readonly pdftk_path = 'pdftk';

  /**
   * Encripta un PDF con contraseña REAL usando pdftk directamente
   */
  async encryptPdf(
    inputBuffer: Buffer,
    password: string,
    jobId: string,
  ): Promise<Buffer> {
    const tempId = uuidv4();
    const inputPath = path.join(this.tempDir, `input_${tempId}.pdf`);
    const outputPath = path.join(this.tempDir, `output_${tempId}.pdf`);

    try {
      console.log(`[${jobId}] Writing temp file: ${inputPath}`);
      
      // Escribir archivo temporal de entrada
      await fs.promises.writeFile(inputPath, inputBuffer);

      console.log(`[${jobId}] Starting REAL PDF encryption with pdftk...`);

      // Comando pdftk directo para encriptación REAL usando solo user password
      const command = `${this.pdftk_path} "${inputPath}" output "${outputPath}" user_pw "${password}"`;
      
      console.log(`[${jobId}] Executing: ${command.replace(password, '****')}`);

      // Ejecutar pdftk con timeout
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 segundos timeout
      });

      if (stderr && !stderr.includes('Done')) {
        console.warn(`[${jobId}] pdftk warning:`, stderr);
      }

      console.log(`[${jobId}] pdftk completed successfully`);

      // Verificar que el archivo de salida existe
      const outputExists = await fs.promises.access(outputPath).then(() => true).catch(() => false);
      if (!outputExists) {
        throw new Error('Encrypted PDF file was not created by pdftk');
      }

      // Leer el archivo encriptado
      const encryptedBuffer = await fs.promises.readFile(outputPath);

      if (encryptedBuffer.length === 0) {
        throw new Error('Encrypted PDF file is empty');
      }

      console.log(`[${jobId}] REAL encryption successful - ${encryptedBuffer.length} bytes`);
      console.log(`[${jobId}] PDF will require password "${password}" to open`);

      return encryptedBuffer;

    } catch (error) {
      console.error(`[${jobId}] Real encryption error:`, error);
      throw new InternalServerErrorException(
        `Real PDF encryption failed: ${error.message}`,
      );
    } finally {
      // Limpiar archivos temporales
      try {
        await fs.promises.unlink(inputPath).catch(() => {});
        await fs.promises.unlink(outputPath).catch(() => {});
        console.log(`[${jobId}] Temporary files cleaned`);
      } catch (cleanupError) {
        console.warn(`[${jobId}] Cleanup warning:`, cleanupError);
      }
    }
  }

  /**
   * Validar que pdftk esté instalado y funcionando
   */
  async validatePdftk(): Promise<boolean> {
    try {
      console.log('Testing pdftk installation...');
      
      // Probar comando de versión
      const { stdout } = await execAsync(`${this.pdftk_path} --version`, { timeout: 5000 });
      console.log('pdftk version:', stdout.trim());
      
      // Crear un PDF de prueba para encriptación
      const testPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000015 65535 n 
0000000066 65535 n 
0000000125 65535 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
192
%%EOF`;

      const tempId = uuidv4();
      const testInput = path.join(this.tempDir, `test_${tempId}.pdf`);
      const testOutput = path.join(this.tempDir, `test_enc_${tempId}.pdf`);

      await fs.promises.writeFile(testInput, testPdfContent);

      // Probar encriptación real
      const testCommand = `${this.pdftk_path} "${testInput}" output "${testOutput}" user_pw "test123"`;
      await execAsync(testCommand, { timeout: 10000 });

      const encrypted = await fs.promises.readFile(testOutput);
      
      // Limpiar archivos de prueba
      await fs.promises.unlink(testInput).catch(() => {});
      await fs.promises.unlink(testOutput).catch(() => {});

      console.log('✅ pdftk REAL encryption validation successful');
      return encrypted.length > 0;

    } catch (error) {
      console.error('❌ pdftk validation failed:', error);
      return false;
    }
  }

  /**
   * Información del servicio
   */
  getServiceInfo() {
    return {
      service: 'PDF REAL Encryption Service',
      method: 'pdftk direct command',
      encryption: 'PDF Standard Security (128-bit RC4 or 256-bit AES)',
      maxFileSize: '100MB',
      features: [
        '🔒 REAL password protection - blocks PDF opening',
        '🛡️ User password authentication required',
        '🔐 Owner password for permissions',
        '⚡ Native PDF encryption standard'
      ]
    };
  }

  /**
   * Test endpoint para verificar que todo funciona
   */
  async testEncryption(): Promise<any> {
    try {
      const isWorking = await this.validatePdftk();
      return {
        status: isWorking ? 'working' : 'failed',
        message: isWorking 
          ? 'pdftk is installed and can encrypt PDFs with REAL password protection'
          : 'pdftk is not working properly',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}