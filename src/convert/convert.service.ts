//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\convert\convert.service.ts

import { Injectable } from '@nestjs/common';
import { 
  mkdtempSync, 
  writeFileSync, 
  createReadStream, 
  rmSync, 
  existsSync, 
  statSync,        // ✅ AGREGADO
  readdirSync      // ✅ AGREGADO
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const exec = promisify(execFile);

@Injectable()
export class ConvertService {
  async wordToPdf(buffer: Buffer, filename: string) {
    const dir = mkdtempSync(join(tmpdir(), 'conv-'));
    const ext = filename.toLowerCase().endsWith('.docx') ? '.docx' : '.doc';
    const inFile = join(dir, `input${ext}`);
    const outPdf = join(dir, 'input.pdf');

    console.log('🔍 Debug info:');
    console.log('- Temp dir:', dir);
    console.log('- Input file:', inFile);
    console.log('- Output PDF:', outPdf);
    console.log('- Platform:', process.platform);
    console.log('- Filename:', filename);
    console.log('- Buffer size:', buffer.length);

    const cleanup = () => rmSync(dir, { recursive: true, force: true });

    try {
      writeFileSync(inFile, buffer);
      console.log('✅ File written:', existsSync(inFile));

      // Rutas posibles de LibreOffice
      const possiblePaths = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        'soffice'
      ];

      let libreOfficePath: string | null = null;
      for (const path of possiblePaths) {
        try {
          await exec(path, ['--version']);
          libreOfficePath = path;
          console.log('✅ LibreOffice encontrado en:', path);
          break;
        } catch (e) {
          console.log('❌ No encontrado en:', path);
          continue;
        }
      }

      if (!libreOfficePath) {
        throw new Error('LibreOffice no encontrado. Instálalo desde https://www.libreoffice.org/download/');
      }

      await exec(libreOfficePath, [
        '--headless',
        '--invisible',
        '--nodefault',
        '--nolockcheck',
        '--nologo',
        '--norestore',
        '--convert-to', 'pdf',
        '--outdir', dir,
        inFile,
      ]);

      // Agregar estas líneas justo después del exec anterior
      try {
        await exec('taskkill', ['/f', '/im', 'soffice.exe'], { timeout: 2000 });
        await exec('taskkill', ['/f', '/im', 'soffice.bin'], { timeout: 2000 });
      } catch (killError) {
        console.log('Procesos LibreOffice cerrados');
      }

      console.log('🔍 Después de conversión:');
      console.log('- PDF existe:', existsSync(outPdf));
      
      if (existsSync(outPdf)) {
        const stats = statSync(outPdf);  // ✅ AHORA FUNCIONA
        console.log('- PDF tamaño:', stats.size, 'bytes');
        
        if (stats.size === 0) {
          throw new Error('El PDF generado está vacío');
        }
      }

      if (!existsSync(outPdf)) {
        const files = readdirSync(dir);  // ✅ AHORA FUNCIONA
        console.log('📁 Archivos en directorio:', files);
        throw new Error('No se pudo generar el PDF');
      }

      console.log('✅ Conversión exitosa');
      const stream = createReadStream(outPdf);
      stream.on('close', cleanup);
      return stream;
    } catch (e: any) {
      console.error('❌ Error de conversión:', e.message);
      cleanup();
      throw new Error(`LibreOffice error: ${e?.stderr || e?.message || e}`);
    }
  }

  async pdfToDocx(buffer: Buffer) {
    const dir = mkdtempSync(join(tmpdir(), 'conv-'));
    const inPdf = join(dir, 'input.pdf');
    const out1 = join(dir, 'input.docx');
    const out2 = join(dir, 'input.pdf.docx');
    const odt = join(dir, 'input.odt');

    const cleanup = () => rmSync(dir, { recursive: true, force: true });

    try {
      writeFileSync(inPdf, buffer);

      // Encontrar LibreOffice
      const possiblePaths = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        'soffice'
      ];

      let libreOfficePath: string | null = null;
      for (const path of possiblePaths) {
        try {
          await exec(path, ['--version']);
          libreOfficePath = path;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!libreOfficePath) {
        throw new Error('LibreOffice no encontrado.');
      }

      // Usar la sintaxis exacta que funcionaba antes
      await exec(libreOfficePath, [
        '--headless',
        '--infilter=writer_pdf_import',
        '--convert-to', 'docx:MS Word 2007 XML',
        '--outdir', dir,
        inPdf,
      ]);

      if (existsSync(out1) || existsSync(out2)) {
        const ok = existsSync(out1) ? out1 : out2;
        const stream = createReadStream(ok);
        stream.on('close', cleanup);
        return stream;
      }

      // Plan B: PDF -> ODT -> DOCX
      await exec(libreOfficePath, [
        '--headless',
        '--infilter=writer_pdf_import',
        '--convert-to', 'odt',
        '--outdir', dir,
        inPdf,
      ]);

      if (!existsSync(odt)) {
        throw new Error('No se pudo generar ODT desde PDF.');
      }

      await exec(libreOfficePath, [
        '--headless',
        '--convert-to', 'docx:MS Word 2007 XML',
        '--outdir', dir,
        odt,
      ]);

      if (existsSync(out1) || existsSync(out2)) {
        const ok = existsSync(out1) ? out1 : out2;
        const stream = createReadStream(ok);
        stream.on('close', cleanup);
        return stream;
      }

      throw new Error('No se generó el DOCX (PDF escaneado o sin texto).');
    } catch (e: any) {
      cleanup();
      throw new Error(`LibreOffice error: ${e?.stderr || e?.message || e}`);
    }
  }

  async compressPdf(buffer: Buffer, filename: string) {
    const dir = mkdtempSync(join(tmpdir(), 'comp-'));
    const inPdf = join(dir, 'input.pdf');
    const outPdf = join(dir, 'compressed.pdf');
    const cleanup = () => rmSync(dir, { recursive: true, force: true });

    try {
      // 1️⃣ Guardar archivo de entrada
      writeFileSync(inPdf, buffer);
      const originalSize = buffer.length;
      console.log('📝 Procesando PDF:', { size: originalSize, filename });

      // 2️⃣ Buscar herramientas de compresión disponibles
      const compressionResult = await this.tryCompressionMethods(inPdf, outPdf, originalSize);
      
      // 3️⃣ Retornar resultado
      const finalFile = existsSync(outPdf) ? outPdf : inPdf;
      const compressedSize = statSync(finalFile).size;  // ✅ AHORA FUNCIONA
      const reduction = Math.max(0, Number(((originalSize - compressedSize) / originalSize * 100).toFixed(1)));

      console.log('📊 Resultado final:', { 
        originalSize, 
        compressedSize, 
        reduction: `${reduction}%`,
        method: compressionResult.method 
      });

      const stream = createReadStream(finalFile);
      stream.on('close', cleanup);
      
      return { 
        stream, 
        originalSize, 
        compressedSize, 
        reduction, 
        engine: compressionResult.method 
      };
    } catch (error: any) {
      console.error('❌ Error de compresión:', error.message);
      cleanup();
      throw new Error(`Error de compresión: ${error.message}`);
    }
  }

  private async tryCompressionMethods(inPdf: string, outPdf: string, originalSize: number) {
    // 🎯 MÉTODO 1: Ghostscript (el mejor para compresión real)
    const gsResult = await this.tryGhostscript(inPdf, outPdf, originalSize);
    if (gsResult.success) return gsResult;

    // 🎯 MÉTODO 2: QPDF (optimización estructural)
    const qpdfResult = await this.tryQpdf(inPdf, outPdf, originalSize);
    if (qpdfResult.success) return qpdfResult;

    // 🎯 MÉTODO 3: LibreOffice re-procesado (última alternativa)
    const libreResult = await this.tryLibreOffice(inPdf, outPdf, originalSize);
    if (libreResult.success) return libreResult;

    console.warn('⚠️ Todas las herramientas de compresión fallaron');
    return { success: false, method: 'none', reduction: 0 };
  }

  private async tryGhostscript(inPdf: string, outPdf: string, originalSize: number) {
    try {
      // Buscar Ghostscript
      const gsPath = await this.findGhostscript();
      if (!gsPath) throw new Error('Ghostscript no encontrado');

      console.log('🚀 Intentando Ghostscript:', gsPath);

      // 📦 Perfiles de compresión escalonados
      const profiles = {
        // Compresión equilibrada (recomendado)
        balanced: [
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.6',
          '-dPDFSETTINGS=/ebook',
          '-dDetectDuplicateImages=true',
          '-dCompressPages=true',
          '-dUseFlateCompression=true',
          '-dAutoFilterColorImages=false',
          '-dColorImageFilter=/DCTEncode',
          '-dJPEGQ=70',
          '-dColorImageResolution=150',
          '-dDownsampleColorImages=true',
          '-dGrayImageFilter=/DCTEncode',
          '-dGrayImageResolution=150', 
          '-dDownsampleGrayImages=true',
          '-dMonoImageResolution=300',
          '-dDownsampleMonoImages=true',
          '-dSubsetFonts=true',
          '-dCompressFonts=true',
          '-dNOPAUSE', '-dQUIET', '-dBATCH'
        ],
        // Compresión agresiva 
        aggressive: [
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.5',
          '-dPDFSETTINGS=/screen',
          '-dDetectDuplicateImages=true',
          '-dCompressPages=true',
          '-dUseFlateCompression=true',
          '-dAutoFilterColorImages=false',
          '-dColorImageFilter=/DCTEncode',
          '-dJPEGQ=50',
          '-dColorImageResolution=100',
          '-dDownsampleColorImages=true',
          '-dGrayImageFilter=/DCTEncode',
          '-dGrayImageResolution=100',
          '-dDownsampleGrayImages=true',
          '-dMonoImageResolution=200',
          '-dDownsampleMonoImages=true',
          '-dSubsetFonts=true',
          '-dCompressFonts=true',
          '-dNOPAUSE', '-dQUIET', '-dBATCH'
        ],
        // Ultra compresión (para casos extremos)
        ultra: [
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.4',
          '-dPDFSETTINGS=/screen',
          '-dDetectDuplicateImages=true',
          '-dCompressPages=true',
          '-dUseFlateCompression=true',
          '-dAutoFilterColorImages=false',
          '-dColorImageFilter=/DCTEncode',
          '-dJPEGQ=30',
          '-dColorImageResolution=72',
          '-dDownsampleColorImages=true',
          '-dGrayImageFilter=/DCTEncode',
          '-dGrayImageResolution=72',
          '-dDownsampleGrayImages=true',
          '-dMonoImageResolution=150',
          '-dDownsampleMonoImages=true',
          '-dSubsetFonts=true',
          '-dCompressFonts=true',
          '-dNOPAUSE', '-dQUIET', '-dBATCH'
        ]
      };

      // Probar perfiles en orden hasta conseguir buena compresión
      for (const [profileName, args] of Object.entries(profiles)) {
        console.log(`🔄 Probando perfil: ${profileName}`);
        
        const fullArgs = [
          ...args,
          `-sOutputFile=${outPdf}`,
          inPdf
        ];

        await exec(gsPath, fullArgs, { timeout: 60000 });

        if (existsSync(outPdf)) {
          const compressedSize = statSync(outPdf).size;  // ✅ AHORA FUNCIONA
          const reduction = ((originalSize - compressedSize) / originalSize) * 100;
          
          console.log(`✅ ${profileName}: ${compressedSize} bytes (${reduction.toFixed(1)}% reducción)`);
          
          // Si conseguimos al menos 20% de reducción, lo aceptamos
          // Para ultra compresión, aceptamos cualquier reducción
          if (reduction >= 20 || profileName === 'ultra') {
            return { 
              success: true, 
              method: `ghostscript-${profileName}`, 
              reduction 
            };
          }
        }
        
        // Limpiar para siguiente intento
        if (existsSync(outPdf)) rmSync(outPdf);
      }

      throw new Error('Ghostscript no logró compresión significativa');
      
    } catch (error: any) {
      console.log('❌ Ghostscript falló:', error.message);
      return { success: false, method: 'ghostscript-failed', reduction: 0 };
    }
  }

  private async tryQpdf(inPdf: string, outPdf: string, originalSize: number) {
    try {
      // Buscar QPDF
      const qpdfPath = await this.findCommand('qpdf');
      if (!qpdfPath) throw new Error('QPDF no encontrado');

      console.log('🔄 Intentando QPDF para optimización...');

      await exec(qpdfPath, [
        '--optimize-images',
        '--object-streams=generate',
        '--compress-streams=y',
        '--recompress-flate',
        '--normalize-content=y',
        inPdf,
        outPdf
      ], { timeout: 30000 });

      if (existsSync(outPdf)) {
        const compressedSize = statSync(outPdf).size;  // ✅ AHORA FUNCIONA
        const reduction = ((originalSize - compressedSize) / originalSize) * 100;
        console.log(`✅ QPDF: ${compressedSize} bytes (${reduction.toFixed(1)}% reducción)`);
        
        if (reduction >= 5) {  // QPDF logra menos reducción pero es útil
          return { success: true, method: 'qpdf', reduction };
        }
      }

      throw new Error('QPDF no logró reducción significativa');
      
    } catch (error: any) {
      console.log('❌ QPDF falló:', error.message);
      return { success: false, method: 'qpdf-failed', reduction: 0 };
    }
  }

  private async tryLibreOffice(inPdf: string, outPdf: string, originalSize: number) {
    try {
      console.log('🔄 Intentando LibreOffice como último recurso...');
      
      // Re-procesar con LibreOffice puede reducir algo
      const libreOfficePath = await this.findLibreOffice();
      if (!libreOfficePath) throw new Error('LibreOffice no encontrado');

      await exec(libreOfficePath, [
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', join(__dirname, '../../..', 'temp'), // Usar ruta absoluta
        inPdf,
      ], { timeout: 30000 });

      // LibreOffice genera input.pdf, necesitamos renombrarlo
      const generatedPdf = join(join(__dirname, '../../..', 'temp'), 'input.pdf');
      if (existsSync(generatedPdf)) {
        // Usar fs.renameSync en lugar de require
        const fs = require('fs');
        fs.renameSync(generatedPdf, outPdf);
        
        const compressedSize = statSync(outPdf).size;  // ✅ AHORA FUNCIONA
        const reduction = ((originalSize - compressedSize) / originalSize) * 100;
        console.log(`✅ LibreOffice: ${compressedSize} bytes (${reduction.toFixed(1)}% reducción)`);
        
        return { success: true, method: 'libreoffice', reduction };
      }

      throw new Error('LibreOffice no generó archivo');
      
    } catch (error: any) {
      console.log('❌ LibreOffice falló:', error.message);
      return { success: false, method: 'libreoffice-failed', reduction: 0 };
    }
  }

  private async findGhostscript(): Promise<string | null> {
    const candidates = process.platform === 'win32' 
      ? ['gswin64c', 'gswin32c', 'gs']
      : ['gs'];

    // Probar comandos directos
    for (const cmd of candidates) {
      try {
        await exec(cmd, ['--version'], { timeout: 5000 });
        console.log(`✅ Ghostscript encontrado: ${cmd}`);
        return cmd;
      } catch {}
    }

    // En Windows, buscar en Program Files
    if (process.platform === 'win32') {
      const basePaths = ['C:\\Program Files\\gs', 'C:\\Program Files (x86)\\gs'];
      for (const basePath of basePaths) {
        if (existsSync(basePath)) {
          const versions = readdirSync(basePath).sort().reverse();  // ✅ AHORA FUNCIONA
          for (const version of versions) {
            const gsPath = join(basePath, version, 'bin', 'gswin64c.exe');
            if (existsSync(gsPath)) {
              console.log(`✅ Ghostscript encontrado en: ${gsPath}`);
              return gsPath;
            }
          }
        }
      }
    }

    return null;
  }

  private async findLibreOffice(): Promise<string | null> {
    const paths = process.platform === 'win32'
      ? [
          'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
          'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
        ]
      : ['soffice', 'libreoffice'];

    for (const path of paths) {
      try {
        await exec(path, ['--version'], { timeout: 5000 });
        return path;
      } catch {}
    }
    return null;
  }

  private async findCommand(command: string): Promise<string | null> {
    try {
      const whichCmd = process.platform === 'win32' ? 'where' : 'which';
      await exec(whichCmd, [command], { timeout: 5000 });
      return command;
    } catch {
      return null;
    }
  }


async splitPdf(buffer: Buffer, pages: string, filename: string) {
  const dir = mkdtempSync(join(tmpdir(), 'split-'));
  const inPdf = join(dir, 'input.pdf');
  const outPdf = join(dir, 'output.pdf');
  const cleanup = () => rmSync(dir, { recursive: true, force: true });

  try {
    writeFileSync(inPdf, buffer);
    console.log('📝 Dividiendo PDF:', { filename, pages });

    // Buscar herramienta disponible para dividir
    const result = await this.trySplitMethods(inPdf, outPdf, pages);
    
    if (!existsSync(outPdf)) {
      throw new Error('No se pudo dividir el PDF');
    }

    const stream = createReadStream(outPdf);
    stream.on('close', cleanup);
    return stream;
  } catch (error: any) {
    cleanup();
    throw new Error(`Error al dividir PDF: ${error.message}`);
  }
}

async mergePdfs(files: Buffer[], filenames: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'merge-'));
  const inputFiles: string[] = [];
  const outPdf = join(dir, 'merged.pdf');
  const cleanup = () => rmSync(dir, { recursive: true, force: true });

  try {
    // Guardar todos los archivos de entrada
    for (let i = 0; i < files.length; i++) {
      const inputFile = join(dir, `input_${i}.pdf`);
      writeFileSync(inputFile, files[i]);
      inputFiles.push(inputFile);
    }

    console.log('📝 Uniendo PDFs:', { count: files.length, filenames });

    // Buscar herramienta disponible para unir
    const result = await this.tryMergeMethods(inputFiles, outPdf);
    
    if (!existsSync(outPdf)) {
      throw new Error('No se pudo unir los PDFs');
    }

    const stream = createReadStream(outPdf);
    stream.on('close', cleanup);
    return stream;
  } catch (error: any) {
    cleanup();
    throw new Error(`Error al unir PDFs: ${error.message}`);
  }
}

private async trySplitMethods(inPdf: string, outPdf: string, pages: string) {
  // MÉTODO 1: Ghostscript (mejor opción)
  const gsResult = await this.trySplitWithGhostscript(inPdf, outPdf, pages);
  if (gsResult.success) return gsResult;

  // MÉTODO 2: QPDF
  const qpdfResult = await this.trySplitWithQpdf(inPdf, outPdf, pages);
  if (qpdfResult.success) return qpdfResult;

  throw new Error('No se encontraron herramientas para dividir PDF');
}

private async tryMergeMethods(inputFiles: string[], outPdf: string) {
  // MÉTODO 1: Ghostscript (mejor opción)
  const gsResult = await this.tryMergeWithGhostscript(inputFiles, outPdf);
  if (gsResult.success) return gsResult;

  // MÉTODO 2: QPDF
  const qpdfResult = await this.tryMergeWithQpdf(inputFiles, outPdf);
  if (qpdfResult.success) return qpdfResult;

  throw new Error('No se encontraron herramientas para unir PDFs');
}

private async trySplitWithGhostscript(inPdf: string, outPdf: string, pages: string) {
  try {
    const gsPath = await this.findGhostscript();
    if (!gsPath) throw new Error('Ghostscript no encontrado');

    console.log('🚀 Dividiendo con Ghostscript:', { pages });

    // Convertir formato de páginas (1-3,5,7-10) a formato Ghostscript
    const ghostscriptPages = this.parsePageRanges(pages);

    await exec(gsPath, [
      '-sDEVICE=pdfwrite',
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      '-dSAFER',
      `-sPageList=${ghostscriptPages}`,
      `-sOutputFile=${outPdf}`,
      inPdf
    ], { timeout: 30000 });

    return { success: true, method: 'ghostscript' };
  } catch (error: any) {
    console.log('❌ Ghostscript split falló:', error.message);
    return { success: false, method: 'ghostscript-failed' };
  }
}

private async trySplitWithQpdf(inPdf: string, outPdf: string, pages: string) {
  try {
    const qpdfPath = await this.findCommand('qpdf');
    if (!qpdfPath) throw new Error('QPDF no encontrado');

    console.log('🚀 Dividiendo con QPDF:', { pages });

    await exec(qpdfPath, [
      inPdf,
      `--pages`,
      inPdf,
      pages,
      '--',
      outPdf
    ], { timeout: 30000 });

    return { success: true, method: 'qpdf' };
  } catch (error: any) {
    console.log('❌ QPDF split falló:', error.message);
    return { success: false, method: 'qpdf-failed' };
  }
}

  async pdfToExcel(buffer: Buffer, filename: string) {
    const dir = mkdtempSync(join(tmpdir(), 'pdf2excel-'));
    const xlsxFile = join(dir, 'output.xlsx');
    const cleanup = () => rmSync(dir, { recursive: true, force: true });

    try {
      // 🔍 Usa pdf-parse para extraer texto
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('PDF Data');

      // dividir por saltos de línea
      const lines = data.text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

      lines.forEach((line: string, idx: number) => {
        // separa por espacios → cada palabra en una celda
        const row = line.split(/\s+/);
        sheet.addRow(row);
      });

      await workbook.xlsx.writeFile(xlsxFile);

      const stream = createReadStream(xlsxFile);
      stream.on('close', cleanup);
      return stream;
    } catch (e: any) {
      cleanup();
      throw new Error(`Error al convertir PDF a Excel: ${e.message}`);
    }
  }


async excelToPdf(fileBuffer: Buffer, filename: string) {
  const dir = mkdtempSync(join(tmpdir(), 'excel2pdf-'));
  const excelFile = join(dir, 'input.xlsx');
  const pdfFile = join(dir, 'output.pdf');
  const cleanup = () => rmSync(dir, { recursive: true, force: true });

  try {
    writeFileSync(excelFile, fileBuffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFile);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error('El archivo Excel no contiene hojas de cálculo');
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const fs = require('fs');
    const streamFile = fs.createWriteStream(pdfFile);
    doc.pipe(streamFile);

    doc.fontSize(10);
    
    sheet.eachRow((row, rowNumber) => {
      const values = row.values as any[];
      const filteredValues = values.slice(1).filter(v => v !== null && v !== undefined);
      
      if (filteredValues.length > 0) {
        doc.text(filteredValues.join(' | '));
      }
    });

    doc.end();

    await new Promise((resolve) => streamFile.on('finish', resolve));

    const stream = createReadStream(pdfFile);
    stream.on('close', cleanup);
    return stream;
  } catch (e: any) {
    cleanup();
    throw new Error(`Error al convertir Excel a PDF: ${e.message}`);
  }
}


private async tryMergeWithGhostscript(inputFiles: string[], outPdf: string) {
  try {
    const gsPath = await this.findGhostscript();
    if (!gsPath) throw new Error('Ghostscript no encontrado');

    console.log('🚀 Uniendo con Ghostscript:', { count: inputFiles.length });

    await exec(gsPath, [
      '-sDEVICE=pdfwrite',
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      '-dSAFER',
      `-sOutputFile=${outPdf}`,
      ...inputFiles
    ], { timeout: 60000 });

    return { success: true, method: 'ghostscript' };
  } catch (error: any) {
    console.log('❌ Ghostscript merge falló:', error.message);
    return { success: false, method: 'ghostscript-failed' };
  }
}

private async tryMergeWithQpdf(inputFiles: string[], outPdf: string) {
  try {
    const qpdfPath = await this.findCommand('qpdf');
    if (!qpdfPath) throw new Error('QPDF no encontrado');

    console.log('🚀 Uniendo con QPDF:', { count: inputFiles.length });

    // QPDF usa sintaxis: qpdf --empty --pages file1.pdf file2.pdf -- output.pdf
    await exec(qpdfPath, [
      '--empty',
      '--pages',
      ...inputFiles,
      '--',
      outPdf
    ], { timeout: 60000 });

    return { success: true, method: 'qpdf' };
  } catch (error: any) {
    console.log('❌ QPDF merge falló:', error.message);
    return { success: false, method: 'qpdf-failed' };
  }
}

private parsePageRanges(pages: string): string {
  // Convierte "1-3,5,7-10" a formato que entiende Ghostscript
  return pages.replace(/\s+/g, '').replace(/-/g, '-');
}


}