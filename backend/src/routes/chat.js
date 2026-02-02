const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../utils/db');

// OpenAI integration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    const aiResponse = data.choices[0]?.message?.content || getFallbackResponse(message, currentZone.zone, employee.first_name);

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
