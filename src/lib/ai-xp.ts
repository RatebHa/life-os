import { calculateXP } from './xp-engine';
import type { Priority, DomainId } from './types';

interface TaskContext {
  title: string;
  description?: string | null;
  priority: Priority;
  domain_id: DomainId;
  time_estimate_minutes?: number | null;
  is_mit: boolean;
}

interface AIXpResult {
  xp: number;
  reason: string;
  ai_scored: boolean;
}

export async function scoreTaskXP(task: TaskContext, apiKey: string | null): Promise<AIXpResult> {
  if (!apiKey) {
    return {
      xp: calculateXP(task),
      reason: 'Rule-based scoring (no API key)',
      ai_scored: false,
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: 'You are an XP scoring engine for a productivity app. Return only JSON: {"xp": number, "reason": string}. XP range: 10-500. Consider task complexity, importance, and time investment.',
        messages: [{
          role: 'user',
          content: `Task: ${task.title}. Description: ${task.description ?? 'none'}. Priority: ${task.priority}. Domain: ${task.domain_id}. Time estimate: ${task.time_estimate_minutes ?? 'unknown'} minutes.`,
        }],
      }),
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text);

    if (typeof parsed.xp === 'number' && typeof parsed.reason === 'string') {
      return { xp: Math.round(parsed.xp), reason: parsed.reason, ai_scored: true };
    }
    throw new Error('Invalid response shape');
  } catch {
    return {
      xp: calculateXP(task),
      reason: 'Rule-based fallback (AI scoring failed)',
      ai_scored: false,
    };
  }
}
