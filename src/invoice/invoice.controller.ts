import { Controller, Post, Body } from '@nestjs/common';
import { InvoiceService } from './invoice.service';

@Controller('invoice')
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @Post('reserve')
  reserve(@Body() body: { buyer?: string; total?: number }) {
    return this.service.reserveNumber(body);
  }
}
