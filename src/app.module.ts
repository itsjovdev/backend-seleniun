import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConvertModule } from './convert/convert.module';
import { InvoiceModule } from './invoice/invoice.module';
import { PdfModule } from './pdf/pdf.module';

const USE_DB = process.env.USE_DB !== '0'; // 👈 si pones USE_DB=0, no carga TypeORM

@Module({
  imports: [
    ...(USE_DB
      ? [
          TypeOrmModule.forRoot({
            type: 'mysql',
            host: process.env.DB_HOST!,
            port: +(process.env.DB_PORT!),
            username: process.env.DB_USER!,
            password: process.env.DB_PASS!,
            database: process.env.DB_NAME!,
            autoLoadEntities: true,
            synchronize: process.env.TYPEORM_SYNC === 'true',
          }),
        ]
      : []),
    ConvertModule,
    InvoiceModule,
    PdfModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
