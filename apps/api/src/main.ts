import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { closeDbPool } from "./db";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const bodyParser = require("body-parser") as {
    json: (options: { limit: string }) => (req: unknown, res: unknown, next: () => void) => void;
    urlencoded: (options: { extended: boolean; limit: string }) => (req: unknown, res: unknown, next: () => void) => void;
  };
  const port = Number(process.env.API_PORT ?? 3001);
  const corsOrigin = process.env.API_CORS_ORIGIN ?? "http://localhost:3000";

  app.setGlobalPrefix("api");
  app.use(bodyParser.json({ limit: "4mb" }));
  app.use(
    bodyParser.urlencoded({
      extended: true,
      limit: "4mb"
    })
  );
  app.enableCors({
    origin: corsOrigin
  });
  app.enableShutdownHooks();

  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`API ready on http://localhost:${port}/api/health`);

  let isShuttingDown = false;
  const closeResources = async () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    await app.close();
    await closeDbPool();
  };

  process.once("SIGINT", () => {
    void closeResources();
  });
  process.once("SIGTERM", () => {
    void closeResources();
  });
}

bootstrap();
