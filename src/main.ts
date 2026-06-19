import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function getAllowedOrigins(): string[] | boolean {
  const frontendUrl = process.env.FRONTEND_URL;

  if (frontendUrl) {
    return frontendUrl
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return process.env.NODE_ENV === 'production' ? false : true;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
