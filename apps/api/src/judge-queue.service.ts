import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import * as amqp from "amqplib";
import { Channel, ChannelModel } from "amqplib";

export type JudgeQueueJob = {
  submissionId: string;
};

const DEFAULT_RABBITMQ_URL = "amqp://guest:guest@localhost:5672";
const DEFAULT_JUDGE_QUEUE_NAME = "judge.submissions.v1";

@Injectable()
export class JudgeQueueService implements OnApplicationShutdown {
  private readonly logger = new Logger(JudgeQueueService.name);
  private readonly rabbitmqUrl = process.env.RABBITMQ_URL ?? DEFAULT_RABBITMQ_URL;
  private readonly queueName = process.env.JUDGE_QUEUE_NAME ?? DEFAULT_JUDGE_QUEUE_NAME;
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private connectingPromise: Promise<Channel> | null = null;

  async enqueueSubmission(job: JudgeQueueJob): Promise<void> {
    const channel = await this.getOrCreateChannel();
    const payload = Buffer.from(JSON.stringify(job));
    const published = channel.sendToQueue(this.queueName, payload, {
      persistent: true,
      contentType: "application/json"
    });

    if (!published) {
      await new Promise<void>((resolve) => {
        channel.once("drain", () => resolve());
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }

  private async getOrCreateChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    if (!this.connectingPromise) {
      this.connectingPromise = this.connect();
    }

    try {
      return await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  private async connect(): Promise<Channel> {
    const connection = await amqp.connect(this.rabbitmqUrl);
    const channel = await connection.createChannel();

    connection.on("close", () => {
      this.logger.warn("RabbitMQ connection closed");
      this.resetConnection();
    });
    connection.on("error", (error: unknown) => {
      this.logger.error(`RabbitMQ connection error: ${this.toErrorMessage(error)}`);
      this.resetConnection();
    });

    channel.on("close", () => {
      this.logger.warn("RabbitMQ channel closed");
      this.channel = null;
    });
    channel.on("error", (error: unknown) => {
      this.logger.error(`RabbitMQ channel error: ${this.toErrorMessage(error)}`);
      this.channel = null;
    });

    await channel.assertQueue(this.queueName, { durable: true });

    this.connection = connection;
    this.channel = channel;

    return channel;
  }

  private resetConnection(): void {
    this.connection = null;
    this.channel = null;
  }

  private async close(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;
    this.channel = null;
    this.connection = null;

    if (channel) {
      await channel.close();
    }

    if (connection) {
      await connection.close();
    }
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
