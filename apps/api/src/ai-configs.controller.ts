import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put
} from "@nestjs/common";
import {
  createUserAiConfig,
  deleteUserAiConfig,
  getOrCreateDemoUserId,
  listUserAiConfigState,
  updateUserAiConfig,
  updateUserAiDefaults
} from "./ai-config-store";

type CreateAiConfigBody = {
  name?: string;
  providerKind?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

type UpdateAiConfigBody = {
  name?: string;
  providerKind?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

type UpdateDefaultsBody = {
  reviewConfigId?: string | null;
  solutionConfigId?: string | null;
};

@Controller("ai/configs")
export class AiConfigsController {
  @Get()
  async listConfigs() {
    const userId = await getOrCreateDemoUserId();
    const state = await listUserAiConfigState(userId);
    return state;
  }

  @Post()
  async createConfig(@Body() body: CreateAiConfigBody) {
    if (!body.name || !body.baseUrl || !body.model || !body.apiKey) {
      throw new BadRequestException("缺少必填字段：name/baseUrl/model/apiKey");
    }

    try {
      const userId = await getOrCreateDemoUserId();
      const item = await createUserAiConfig(userId, {
        name: body.name,
        providerKind: body.providerKind,
        baseUrl: body.baseUrl,
        model: body.model,
        apiKey: body.apiKey
      });
      return { item };
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(":id")
  async updateConfig(@Param("id") configId: string, @Body() body: UpdateAiConfigBody) {
    const hasChanges =
      body.name !== undefined ||
      body.providerKind !== undefined ||
      body.baseUrl !== undefined ||
      body.model !== undefined ||
      body.apiKey !== undefined;

    if (!hasChanges) {
      throw new BadRequestException("至少需要提供一个可更新字段");
    }

    try {
      const userId = await getOrCreateDemoUserId();
      const item = await updateUserAiConfig(userId, configId, body);
      if (!item) {
        throw new NotFoundException("AI 配置不存在");
      }

      return { item };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Delete(":id")
  async deleteConfig(@Param("id") configId: string) {
    const userId = await getOrCreateDemoUserId();
    const deleted = await deleteUserAiConfig(userId, configId);
    if (!deleted) {
      throw new NotFoundException("AI 配置不存在");
    }

    return { deleted: true };
  }

  @Put("defaults")
  async updateDefaults(@Body() body: UpdateDefaultsBody) {
    const hasAnyField = body.reviewConfigId !== undefined || body.solutionConfigId !== undefined;
    if (!hasAnyField) {
      throw new BadRequestException("至少需要提供 reviewConfigId 或 solutionConfigId");
    }

    try {
      const userId = await getOrCreateDemoUserId();
      const item = await updateUserAiDefaults(userId, body);
      return { item };
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
