// backend/src/ai-analytics/ai-analytics.service.ts
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiAnalyticsService {
  private openai: OpenAI;
  private readonly logger = new Logger(AiAnalyticsService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY no está definida en las variables de entorno.');
    }

    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async processUserQuery(userPrompt: string) {
    // 1. Definición de herramientas que la IA puede invocar de forma segura
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'getFleetSummary',
          description: 'Obtiene un resumen general del estado actual de los vehículos (total vehículos, en ruta, offline, inactivos).',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getDriverPerformance',
          description: 'Obtiene métricas de un conductor o de todos (distancia recorrida, velocidad máxima registrada, horas activas).',
          parameters: {
            type: 'object',
            properties: {
              driverName: { type: 'string', description: 'Nombre del conductor (opcional)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getSpeedingIncidents',
          description: 'Consulta los registros donde se superó el límite de velocidad especificado.',
          parameters: {
            type: 'object',
            properties: {
              speedLimitLimit: { type: 'number', description: 'Límite de velocidad a evaluar en km/h (ej. 80)' },
            },
            required: ['speedLimitLimit'],
          },
        },
      },
    ];

    const systemPrompt = `Eres el asistente de Inteligencia Artificial de GeoTracker PRO, experto en análisis de datos de telemetría y logística.
Responde de manera profesional, concisa y estructurada. Si necesitas datos de la base de datos para responder, usa las herramientas disponibles.`;

    try {
      // 2. Primera llamada al modelo con el prompt del usuario y las tools
        const response = await this.openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // Modelo eficiente y de bajo costo
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools,
        tool_choice: 'auto',
      });

      const responseMessage = response.choices[0].message;

      // 3. Verificar si el LLM solicitó la ejecución de alguna herramienta
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        const messagesHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
          responseMessage, // Incluye la petición de herramientas del LLM
        ];

        let lastDataPayload: any = null;
        let lastToolUsed: string | null = null;

        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type === 'function') {
            const functionName = toolCall.function.name;
            let functionArgs: any = {};

            try {
              functionArgs = JSON.parse(toolCall.function.arguments || '{}');
            } catch (e) {
              this.logger.error(`Error parseando argumentos para ${functionName}: `, e);
            }

            let executionResult: any = null;

            // 4. Mapeo seguro hacia Prisma ORM
            if (functionName === 'getFleetSummary') {
              executionResult = await this.executeFleetSummary();
            } else if (functionName === 'getDriverPerformance') {
              executionResult = await this.executeDriverPerformance(functionArgs.driverName);
            } else if (functionName === 'getSpeedingIncidents') {
              executionResult = await this.executeSpeedingIncidents(functionArgs.speedLimitLimit);
            }

            lastDataPayload = executionResult;
            lastToolUsed = functionName;
            
            // Registrar cada respuesta de herramienta en el historial
            messagesHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(executionResult ?? {}),
            });
          }
        }

        // 5. Enviar el resultado de vuelta al LLM
        const finalResponse = await this.openai.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: messagesHistory,
        });

        return {
          textResponse: finalResponse.choices[0].message.content,
          dataPayload: lastDataPayload,
          toolUsed: lastToolUsed,
        };
      }

    // Si no requirió herramientas, responder directamente
    return {
        textResponse: responseMessage.content,
        dataPayload: null,
        toolUsed: null,
      };
    } catch (error) {
      this.logger.error('Error procesando consulta de IA', error);
      throw new InternalServerErrorException('Error al procesar la solicitud con el asistente de IA.');
    }
  }

  // Métodos de consulta con Prisma ORM (Tipados y Seguros)
  private async executeFleetSummary() {
    const totalRoutes = await this.prisma.route.count({
      where: { Visible: 1 },
    });
    const activeRoutes = await this.prisma.route.count({
      where: { isActive: true, Visible: 1 },
    });
    const totalDrivers = await this.prisma.user.count({
      where: { role: 'DRIVER', Visible: 1 },
    });
    return {
      totalDrivers,
      totalRoutes,
      activeRoutes,
      inactiveRoutes: totalRoutes - activeRoutes,
    };
  }

  private async executeDriverPerformance(driverName?: string) {
    return this.prisma.user.findMany({
      where: {
        role: 'DRIVER',
        Visible: 1,
        ...(driverName ? { name: { contains: driverName, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: { routes: true },
        },
      },
      take: 5,
    });
  }

  private async executeSpeedingIncidents(limit: number) {
    return this.prisma.vehiclePosition.findMany({
      where: {
        speed: { gt: limit },
        Visible: 1,
      },
      select: {
        id: true,
        speed: true,
        lat: true,
        lng: true,
        timestamp: true,
        route: {
          select: {
            id: true,
            name: true,
            driver: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });
  }
}
