import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { HealthController } from "./health.controller";
import { JudgeQueueService } from "./judge-queue.service";
import { ProblemsController } from "./problems.controller";
import { SubmissionsController } from "./submissions.controller";

@Module({
  controllers: [HealthController, ProblemsController, SubmissionsController, AiController],
  providers: [JudgeQueueService]
})
export class AppModule {}
