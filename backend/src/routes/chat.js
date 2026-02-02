const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../utils/db');

// OpenAI integration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Define available functions/tools for the AI
const AVAILABLE_FUNCTIONS = [
  {
    type: 'function',
    function: {
      name: 'add_life_event',
      description: 'Add a life event that affects the user wellness expectations. ONLY use this when the user EXPLICITLY mentions a SPECIFIC event like a new baby, moving, new job, dealing with health issues, major deadlines, etc. DO NOT use this if the user just says "add a life event" without specifying what it is - instead ask them what event they want to add.',
      parameters: {
        type: 'object',
        properties: {
          eventType: {
            type: 'string',
            enum: ['new_baby', 'moving', 'major_deadline', 'health_issue', 'family_care', 'bereavement', 'wedding_planning', 'new_job_role', 'vacation_recovery', 'illness_recovery'],
            description: 'The type of life event'
          },
          eventLabel: {
            type: 'string',
            description: 'A human-readable label for the event'
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the event'
          }
        },
        required: ['eventType', 'eventLabel']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_wellness_score',
      description: 'Get the user current wellness score and zone status. Use this when the user asks about their score, how they are doing, or wants to check their status.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_recommendations',
      description: 'Get personalized wellness recommendations based on the user current state. Use this when the user asks for advice, tips, or what they should do.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: ['sleep', 'stress', 'exercise', 'workload', 'general'],
            description: 'The topic area for recommendations'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_feeling_checkin',
      description: 'Log how the user is feeling right now. Use this when the user describes their current mood or energy level.',
      parameters: {
        type: 'object',
        properties: {
          overallFeeling: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            description: 'Overall feeling from 1 (very bad) to 5 (great)'
          },
          energyLevel: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            description: 'Energy level from 1 (exhausted) to 5 (energized)'
          },
          stressLevel: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            description: 'Stress level from 1 (very stressed) to 5 (calm)'
          },
          notes: {
            type: 'string',
            description: 'Optional notes about how they are feeling'
          }
        },
        required: ['overallFeeling']
      }
    }
  }
];

// Function implementations
async function executeFunction(functionName, args, employeeId, userId) {
  switch (functionName) {
    case 'add_life_event':
      return await addLifeEvent(args, employeeId);
    case 'get_wellness_score':
      return await getWellnessScore(employeeId);
    case 'get_recommendations':
      return await getRecommendations(args, employeeId);
    case 'log_feeling_checkin':
      return await logFeelingCheckin(args, employeeId);
    default:
      return { error: 'Unknown function' };
  }
}

async function addLifeEvent(args, employeeId) {
  try {
    // Get default adjustments from template
    const templateResult = await db.query(
      'SELECT * FROM life_event_templates WHERE event_type = $1',
      [args.eventType]
    );

    const template = templateResult.rows[0];
    const today = new Date().toISOString().split('T')[0];

    // Calculate end date based on template suggestion
    let endDate = null;
    if (template?.suggested_duration_days) {
      const end = new Date();
      end.setDate(end.getDate() + template.suggested_duration_days);
      endDate = end.toISOString().split('T')[0];
    }

    await db.query(`
      INSERT INTO life_events (
        employee_id, event_type, event_label, start_date, end_date,
        sleep_adjustment, work_adjustment, exercise_adjustment,
        stress_tolerance_adjustment, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      employeeId,
      args.eventType,
      args.eventLabel,
      today,
      endDate,
      template?.default_sleep_adjustment || 0,
      template?.default_work_adjustment || 0,
      template?.default_exercise_adjustment || 0,
      template?.default_stress_tolerance_adjustment || 0,
      args.notes || null
    ]);

    return {
      success: true,
      message: `I've added "${args.eventLabel}" to your life events. Your wellness expectations will be adjusted accordingly - I'll be more understanding about sleep and exercise during this time.`,
      eventType: args.eventType,
      adjustments: template ? {
        sleep: template.default_sleep_adjustment,
        work: template.default_work_adjustment,
        exercise: template.default_exercise_adjustment
      } : null
    };
  } catch (error) {
    console.error('Add life event error:', error);
    return { success: false, error: 'Failed to add life event' };
  }
}

async function getWellnessScore(employeeId) {
  try {
    const result = await db.query(`
      SELECT zone, burnout_score, readiness_score, explanation, date
      FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    if (result.rows.length === 0) {
      return { success: true, message: 'No wellness data available yet.' };
    }

    const data = result.rows[0];
    const wellnessScore = Math.round(100 - data.burnout_score);

    return {
      success: true,
      zone: data.zone,
      wellnessScore,
      burnoutScore: Math.round(data.burnout_score),
      readinessScore: Math.round(data.readiness_score),
      factors: data.explanation?.factors || [],
      message: `Your wellness score is ${wellnessScore}/100 and you're in the ${data.zone.toUpperCase()} zone.`
    };
  } catch (error) {
    console.error('Get wellness score error:', error);
    return { success: false, error: 'Failed to get wellness score' };
  }
}

async function getRecommendations(args, employeeId) {
  try {
    // Get current zone
    const zoneResult = await db.query(`
      SELECT zone, burnout_score FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC LIMIT 1
    `, [employeeId]);

    const zone = zoneResult.rows[0]?.zone || 'yellow';
    const topic = args.topic || 'general';

    // Get relevant wellness resources
    const resourcesResult = await db.query(`
      SELECT title, description, content, duration_minutes
      FROM wellness_resources
      WHERE category = $1 OR category = 'general'
      ORDER BY RANDOM()
      LIMIT 2
    `, [topic === 'general' ? 'stress' : topic]);

    return {
      success: true,
      zone,
      topic,
      resources: resourcesResult.rows,
      message: `Based on your ${zone} zone status, here are some recommendations for ${topic}.`
    };
  } catch (error) {
    console.error('Get recommendations error:', error);
    return { success: false, error: 'Failed to get recommendations' };
  }
}

async function logFeelingCheckin(args, employeeId) {
  try {
    await db.query(`
      INSERT INTO feeling_checkins (
        employee_id, overall_feeling, energy_level, stress_level, notes
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      employeeId,
      args.overallFeeling,
      args.energyLevel || null,
      args.stressLevel || null,
      args.notes || null
    ]);

    const feelingLabels = ['', 'struggling', 'not great', 'okay', 'good', 'great'];

    return {
      success: true,
      message: `I've logged that you're feeling ${feelingLabels[args.overallFeeling]}. Thanks for checking in - tracking how you feel helps us personalize your experience.`,
      feeling: args.overallFeeling
    };
  } catch (error) {
    console.error('Log feeling checkin error:', error);
    return { success: false, error: 'Failed to log check-in' };
  }
}

// System prompt for the wellness mentor
const SYSTEM_PROMPT = `You are Shepherd, an empathetic and insightful AI wellness mentor. You're like a supportive friend who happens to be an expert in workplace wellness, stress management, and burnout prevention.

Your personality:
- Warm, genuine, and conversational - talk like a caring friend, not a corporate bot
- Curious and attentive - ask thoughtful follow-up questions
- Encouraging but realistic - celebrate wins without being overly cheerful
- Direct when needed - don't sugarcoat if someone needs to hear the truth

Your capabilities:
- You can ADD LIFE EVENTS when users mention things like new babies, moving, deadlines, health issues, etc.
- You can CHECK their wellness score and explain what it means
- You can LOG how they're feeling with a check-in
- You can PROVIDE personalized recommendations based on their data

Communication style:
- Keep responses conversational and natural (2-3 short paragraphs max)
- Use contractions and casual language ("you're", "let's", "that's tough")
- Vary your responses - don't be repetitive or formulaic
- Ask ONE focused follow-up question when appropriate
- When taking actions, confirm what you did naturally in conversation

CRITICAL RULES FOR LIFE EVENTS:
- ONLY call add_life_event when the user EXPLICITLY states what the event is (e.g., "I'm having a baby", "I just started a new job", "dealing with a health issue")
- If the user just says "add a life event" or "add new life event" WITHOUT specifying what it is, DO NOT call the function. Instead, ASK them what kind of life event they want to add. Give examples like: new job, moving, baby, health issue, deadline, vacation, etc.
- NEVER guess or assume the event type - always get explicit confirmation from the user first

When someone shares something difficult:
- Acknowledge their feelings first before offering solutions
- Don't immediately jump to advice - sometimes people just need to be heard
- Offer one small, actionable suggestion rather than overwhelming lists

Remember: You have access to their wellness data. Use it to personalize your responses - reference specific metrics when relevant, but don't recite data robotically.`;

// Chat endpoint
router.post('/', authenticate, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get employee data for context
    const employeeResult = await db.query(
      'SELECT id, first_name FROM employees WHERE user_id = $1',
      [userId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Get current zone and wellness context
    const zoneResult = await db.query(`
      SELECT zone, burnout_score, readiness_score, explanation, date
      FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employee.id]);

    const currentZone = zoneResult.rows[0] || { zone: 'yellow', burnout_score: 50, readiness_score: 50 };

    // Get recent health metrics for context
    const healthResult = await db.query(`
      SELECT sleep_hours, sleep_quality_score, heart_rate_variability,
             exercise_minutes, resting_heart_rate
      FROM health_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 7
    `, [employee.id]);

    const avgSleep = healthResult.rows.length > 0
      ? (healthResult.rows.reduce((sum, r) => sum + parseFloat(r.sleep_hours || 0), 0) / healthResult.rows.length).toFixed(1)
      : 'unknown';

    const avgSleepQuality = healthResult.rows.length > 0
      ? Math.round(healthResult.rows.reduce((sum, r) => sum + (r.sleep_quality_score || 0), 0) / healthResult.rows.length)
      : 'unknown';

    // Build context message
    const zoneDescriptions = {
      red: "struggling - they may be experiencing burnout symptoms and need support",
      yellow: "managing but could use some attention - not in crisis but not thriving either",
      green: "doing well - good time for growth, challenges, or helping others"
    };

    const wellnessScore = Math.round(100 - currentZone.burnout_score);

    const contextMessage = `
CURRENT USER CONTEXT (use this to personalize your response):
- Their name: ${employee.first_name}
- Wellness Score: ${wellnessScore}/100
- Current state: ${zoneDescriptions[currentZone.zone] || 'unknown'}
- Recent sleep: averaging ${avgSleep} hours/night (quality: ${avgSleepQuality}/100)
${currentZone.explanation?.factors ? `- Contributing factors: ${currentZone.explanation.factors.slice(0, 3).join(', ')}` : ''}

Use these tools when appropriate:
- add_life_event: When they mention life changes (new baby, moving, deadline, health issue, etc.)
- get_wellness_score: When they ask "how am I doing?" or want to see their score
- log_feeling_checkin: When they express how they're feeling right now
- get_recommendations: When they ask for advice or tips`;

    // If no OpenAI key, use fallback responses
    if (!OPENAI_API_KEY) {
      console.log('No OpenAI API key configured - using fallback responses');
      const fallbackResponse = getFallbackResponse(message, currentZone.zone, employee.first_name);
      return res.json({
        response: fallbackResponse,
        zone: currentZone.zone,
        fallback: true
      });
    }

    // Build messages array for OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextMessage },
    ];

    // Add conversation history (last 10 messages max)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Use gpt-4o for better intelligence, fallback to gpt-4o-mini
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    // Call OpenAI API with function calling
    console.log(`Calling OpenAI API with model: ${model}`);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages,
        tools: AVAILABLE_FUNCTIONS,
        tool_choice: 'auto',
        max_tokens: 600,
        temperature: 0.8,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      // Fall back to rule-based response
      const fallbackResponse = getFallbackResponse(message, currentZone.zone, employee.first_name);
      return res.json({
        response: fallbackResponse,
        zone: currentZone.zone,
        fallback: true,
        error: `API error: ${response.status}`
      });
    }

    const data = await response.json();
    const assistantMessage = data.choices[0]?.message;

    // Check if the AI wants to call a function
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      // Execute the function
      const functionResult = await executeFunction(functionName, functionArgs, employee.id, userId);

      // Send the result back to OpenAI to get a natural language response
      messages.push(assistantMessage);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(functionResult)
      });

      const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 500,
          temperature: 0.7,
        })
      });

      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        const finalResponse = followUpData.choices[0]?.message?.content || functionResult.message;

        return res.json({
          response: finalResponse,
          zone: currentZone.zone,
          action: {
            type: functionName,
            result: functionResult
          }
        });
      }

      // If follow-up fails, return the function result message directly
      return res.json({
        response: functionResult.message || 'Action completed.',
        zone: currentZone.zone,
        action: {
          type: functionName,
          result: functionResult
        }
      });
    }

    // No function call - just return the AI response
    const aiResponse = assistantMessage.content || getFallbackResponse(message, currentZone.zone, employee.first_name);

    res.json({
      response: aiResponse,
      zone: currentZone.zone
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Fallback responses when OpenAI is not available
function getFallbackResponse(message, zone, firstName) {
  const lowerMessage = message.toLowerCase();

  // Detect if they want to add a life event
  if (lowerMessage.includes('new baby') || lowerMessage.includes('baby')) {
    return `It sounds like you have some exciting news about a baby! To add this as a life event, I'll need to connect to our AI service. In the meantime, you can add it directly from your dashboard by clicking "+ Add life event" in the Life Events section. This will adjust your wellness expectations accordingly.`;
  }

  if (lowerMessage.includes('moving') || lowerMessage.includes('relocat')) {
    return `Moving is a big life change! You can add this as a life event from your dashboard - just click "+ Add life event" and select "Moving/Relocating". This will help us adjust your wellness expectations during this transition.`;
  }

  // Detect topic
  let topic = 'general';
  if (lowerMessage.includes('stress') || lowerMessage.includes('anxious') || lowerMessage.includes('overwhelm')) {
    topic = 'stress';
  } else if (lowerMessage.includes('sleep') || lowerMessage.includes('tired') || lowerMessage.includes('exhausted')) {
    topic = 'sleep';
  } else if (lowerMessage.includes('work') || lowerMessage.includes('deadline') || lowerMessage.includes('busy')) {
    topic = 'workload';
  } else if (lowerMessage.includes('how am i') || lowerMessage.includes('my score') || lowerMessage.includes('doing')) {
    topic = 'score';
  }

  const responses = {
    red: {
      general: `Hey ${firstName}, I can see things have been tough lately. Your wellness score shows you're in a challenging spot right now. What's been weighing on you the most?`,
      stress: `I hear you on the stress, ${firstName}. When you're feeling this way, even tiny steps help. How about this: right now, take three slow breaths - in for 4, out for 6. Then tell me one thing on your plate that could wait until tomorrow.`,
      sleep: `Sleep is huge for recovery, and yours has been struggling a bit. Here's one thing to try tonight: set a "wind down" alarm 30 minutes before bed. Dim the lights, put away screens, maybe do some light stretching. What time do you usually try to sleep?`,
      workload: `It sounds like work is really piling up. Here's the thing - sustainable pace always beats burnout sprints. What are your actual top 3 priorities this week? Everything else might need to wait or go to someone else.`,
      score: `Your wellness score is showing you're in the red zone right now, ${firstName}. That means your body and mind are telling you they need some extra care. The good news? Small improvements compound fast. What area feels most urgent - sleep, stress, or workload?`
    },
    yellow: {
      general: `Hey ${firstName}! You're in a stable spot - not struggling, but not quite at peak either. This is actually a great time to build habits that'll help when things get busy. What's one area you'd like to focus on?`,
      stress: `Your stress is manageable right now, ${firstName}. To keep it that way, consider protecting at least one hour of focus time daily. What's one meeting you could skip or make async this week?`,
      sleep: `Your sleep is decent but has room to improve. Here's a simple challenge: try going to bed just 15 minutes earlier for the next 3 days. It adds up faster than you'd think. What time are you usually hitting the pillow?`,
      workload: `Workload looks balanced right now. This is the perfect time to build systems for when things get crazy - document a process, create a template, or tackle some technical debt. What's been on your "I should really do this" list?`,
      score: `Your wellness score puts you in the yellow zone - you're stable but have room to optimize. Your sleep and work metrics are decent. Is there a specific area you'd like to improve?`
    },
    green: {
      general: `Nice work, ${firstName}! Your metrics look solid. You're in a great position to take on challenges or help teammates who might be struggling. What's something ambitious you'd like to tackle?`,
      stress: `Your stress levels are healthy - that's excellent! With this kind of capacity, you might consider mentoring someone or taking on that stretch project you've been eyeing. What sounds interesting?`,
      sleep: `Your sleep is excellent! Whatever you're doing, keep it up. This kind of recovery is what enables peak performance. What would you like to accomplish while you're at your best?`,
      workload: `You've got good capacity right now. This is a great time for high-visibility projects or learning something new. What's been on your "someday" list?`,
      score: `Great news, ${firstName}! Your wellness score has you in the green zone - that means you're thriving. Your sleep, stress, and workload are all looking good. This is the perfect time to pursue growth opportunities or help others!`
    }
  };

  return responses[zone]?.[topic] || responses[zone]?.general || responses.yellow.general;
}

module.exports = router;
