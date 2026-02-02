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
      description: 'Add a life event that affects the user wellness expectations. Use this when the user mentions starting something new like a new baby, moving, new job, dealing with health issues, major deadlines, etc.',
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
const SYSTEM_PROMPT = `You are Shepherd, a compassionate and knowledgeable wellness mentor for a workplace wellness app called ShepHerd. Your role is to help employees manage stress, improve sleep, maintain work-life balance, and prevent burnout.

Guidelines:
- Be warm, supportive, and non-judgmental
- Provide evidence-based advice when possible
- Keep responses concise but helpful (2-4 paragraphs max)
- Ask follow-up questions to better understand their situation
- Suggest practical, actionable steps
- If someone seems to be in crisis, gently encourage them to seek professional help
- Never diagnose medical or mental health conditions
- Use their wellness data context to personalize advice
- Be encouraging about small improvements

When discussing their metrics:
- Frame data positively where possible
- Focus on trends, not single data points
- Celebrate improvements, however small
- Suggest one specific action they could take`;

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
    const contextMessage = `
User Context:
- Name: ${employee.first_name}
- Current wellness zone: ${currentZone.zone.toUpperCase()} (${currentZone.zone === 'red' ? 'needs attention' : currentZone.zone === 'yellow' ? 'moderate' : 'doing well'})
- Wellness Score: ${Math.round(100 - currentZone.burnout_score)}/100
- Average sleep (last 7 days): ${avgSleep} hours
- Average sleep quality: ${avgSleepQuality}/100
${currentZone.explanation ? `- Key factors: ${JSON.stringify(currentZone.explanation.factors || [])}` : ''}

Respond to their message with personalized, helpful advice.`;

    // If no OpenAI key, use fallback responses
    if (!OPENAI_API_KEY) {
      const fallbackResponse = getFallbackResponse(message, currentZone.zone, employee.first_name);
      return res.json({
        response: fallbackResponse,
        zone: currentZone.zone
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

    // Call OpenAI API with function calling
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        tools: AVAILABLE_FUNCTIONS,
        tool_choice: 'auto',
        max_tokens: 500,
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      // Fall back to rule-based response
      const fallbackResponse = getFallbackResponse(message, currentZone.zone, employee.first_name);
      return res.json({
        response: fallbackResponse,
        zone: currentZone.zone,
        fallback: true
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

  // Detect topic
  let topic = 'general';
  if (lowerMessage.includes('stress') || lowerMessage.includes('anxious') || lowerMessage.includes('overwhelm')) {
    topic = 'stress';
  } else if (lowerMessage.includes('sleep') || lowerMessage.includes('tired') || lowerMessage.includes('exhausted')) {
    topic = 'sleep';
  } else if (lowerMessage.includes('work') || lowerMessage.includes('deadline') || lowerMessage.includes('busy')) {
    topic = 'workload';
  }

  const responses = {
    red: {
      general: `I can see things have been challenging lately, ${firstName}. Your recent metrics suggest this might be a good time to focus on recovery. What's weighing on you most right now?`,
      stress: `I understand you're feeling stressed. When we're in a challenging zone, even small steps help. Try this: take 3 deep breaths right now, breathing in for 4 counts and out for 6. Then identify just ONE thing you can take off your plate today.`,
      sleep: `Sleep is crucial for recovery, and I can see yours could use some attention. Tonight, try setting a "wind down" alarm 30 minutes before bed - no screens, dim lights, maybe some light stretching. Small improvements compound over time.`,
      workload: `Your workload seems to be impacting your wellness. Remember: sustainable pace beats burnout sprints. Can you identify your top 3 priorities and delegate or defer the rest? It's okay to say "not right now."`,
    },
    yellow: {
      general: `You're in a stable place, ${firstName}. This is actually a great time to build habits that will help when things get busier. What area would you like to focus on improving?`,
      stress: `Your stress levels are manageable right now. To keep them that way, consider building in buffer time between meetings and protecting at least one hour of focus time daily. Prevention is easier than recovery!`,
      sleep: `Your sleep is decent but there's room for optimization. Small changes make a big difference - try going to bed just 15 minutes earlier this week. Your body will thank you.`,
      workload: `Your workload seems balanced currently. Use this time to build systems that'll help when things get busy - document processes, set up templates, or tackle that technical debt.`,
    },
    green: {
      general: `You're doing great, ${firstName}! Your metrics look strong. This is the perfect time to take on challenging work or help a teammate who might be struggling. What ambitious goal would you like to work towards?`,
      stress: `Your stress indicators are healthy - excellent work! Consider using some of this capacity to mentor others or take on that stretch project you've been eyeing.`,
      sleep: `Your sleep is excellent! Keep doing what you're doing. This kind of recovery is what enables peak performance. What would you like to accomplish while you're at your best?`,
      workload: `Your capacity is strong right now. Consider volunteering for high-visibility projects or learning new skills. You're well-positioned to make an impact!`,
    }
  };

  return responses[zone]?.[topic] || responses[zone]?.general || responses.yellow.general;
}

module.exports = router;
