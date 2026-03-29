import { Body, Controller, Post } from "@nestjs/common";

type ReviewBody = {
  problemSlug?: string;
  code?: string;
  status?: string;
  errorMessage?: string | null;
};

type AiTutorResponse = {
  guidance?: string;
};

@Controller("ai")
export class AiController {
  @Post("review")
  async review(@Body() body: ReviewBody) {
    const fallbackMessage = this.buildFallbackGuidance(body);
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? "http://localhost:8000";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${aiTutorBaseUrl}/review`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return { guidance: fallbackMessage, source: "api-fallback" };
      }

      const json = (await response.json()) as AiTutorResponse;

      return {
        guidance: json.guidance ?? fallbackMessage,
        source: "ai-tutor"
      };
    } catch {
      return {
        guidance: fallbackMessage,
        source: "api-fallback"
      };
    }
  }

  private buildFallbackGuidance(body: ReviewBody): string {
    if (body.status === "AC") {
      return "代码已通过。下一步请尝试优化变量命名与边界条件表达，让思路更易读。";
    }

    const errorPart = body.errorMessage ? `错误信息：${body.errorMessage}。` : "";

    return `先不要急着重写。${errorPart}建议你先用最小反例手动推演一次，并重点检查边界处理与循环终止条件。`;
  }
}
