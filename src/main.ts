import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS más permisivo para desarrollo
  app.enableCors({
    origin: [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false
  });

  const port = process.env.PORT ?? 3000;
  
  // CRÍTICO: Para Docker debe escuchar en 0.0.0.0, no solo localhost
  await app.listen(port, '0.0.0.0');
  
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();