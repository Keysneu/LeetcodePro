import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AdminProblemsController } from "./admin-problems.controller";
import { HealthController } from "./health.controller";
import { JudgeQueueService } from "./judge-queue.service";
import { NotesController } from "./notes.controller";
import { ProblemsController } from "./problems.controller";
import { ProgressController } from "./progress.controller";
import { SubmissionsController } from "./submissions.controller";

@Module({
  controllers: [
    HealthController,
    ProblemsController,
    SubmissionsController,
    AiController,
    NotesController,
    AdminProblemsController,
    ProgressController
  ],
  providers: [JudgeQueueService]
})
export class AppModule {}
