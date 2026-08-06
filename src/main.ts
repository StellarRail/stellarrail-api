import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { validateEnv } from './config/configuration';
import * as fs from 'fs';

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3001').split(',');
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TimeoutInterceptor(10000));
  const config = new DocumentBuilder()
    .setTitle('StellarRail API')
    .setVersion('1.0.0-rc1')
    .addBearerAuth()
    .addTag('auth').addTag('users').addTag('payments').addTag('chain').addTag('audit').addTag('admin').addTag('health')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc);
  try { fs.writeFileSync('openapi.json', JSON.stringify(doc, null, 2)); } catch { /* ignore */ }
  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`StellarRail API listening on ${port} network=${process.env.STELLAR_NETWORK}`);
}
void bootstrap();
