import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
      
  // CORS configurado para producción y desarrollo
  app.enableCors({
    origin: [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:3000',
      'https://seleniun.com',
      'https://www.seleniun.com',
      'https://document-intellisense.vercel.app'
    ],
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false
  });

  const port = process.env.PORT || 3000;
        
  // CRÍTICO: Para Docker debe escuchar en 0.0.0.0, no solo localhost
  await app.listen(port, '0.0.0.0');
        
  console.log(`🚀 Backend running on http://0.0.0.0:${port}`);
  console.log(`📝 Health check: http://localhost:${port}`);
}

bootstrap().catch(err => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});