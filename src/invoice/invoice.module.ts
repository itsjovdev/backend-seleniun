import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceCounter } from './entities/invoice-counter.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceCounter])],
  controllers: [InvoiceController],
  providers: [InvoiceService],
})
export class InvoiceModule {}
