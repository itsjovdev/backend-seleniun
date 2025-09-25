import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceCounter } from './entities/invoice-counter.entity';

@Injectable()
export class InvoiceService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceCounter) private counterRepo: Repository<InvoiceCounter>,
  ) {}

  async reserveNumber(data: { buyer?: string; total?: number }) {
    return this.dataSource.transaction(async (manager) => {
      // crea el contador si no existe
      let counter = await manager.findOne(InvoiceCounter, { where: { id: 1 } });
      if (!counter) {
        counter = manager.create(InvoiceCounter, { id: 1, value: 0 });
        await manager.save(counter);
      }
      // incrementa
      counter.value += 1;
      await manager.save(counter);

      const invoiceNumber = `F001-${String(counter.value).padStart(6, '0')}`;
      const invoice = manager.create(Invoice, {
        number: invoiceNumber,
        buyer: data.buyer || '',
        total: Number(data.total || 0),
        date: new Date(),
      });
      await manager.save(invoice);

      return { invoiceNumber, fecha: invoice.date.toISOString().slice(0, 10) };
    });
  }
}
