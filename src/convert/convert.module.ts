import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { WordController } from './word.controller';
import { ConvertService } from './convert.service';
import { CompressPdfController } from './compress-pdf.controller';
import { SplitMergeController } from './split-merge.controller';

@Module({
  controllers: [PdfController, WordController, CompressPdfController, SplitMergeController],
  providers: [ConvertService]
})
export class ConvertModule {}