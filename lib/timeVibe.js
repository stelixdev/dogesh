/**
 * Time-of-Day Vibe Module (IST / India Standard Time)
 * Calibrated to Indian Discord lifestyle (late-night banter, morning sleepiness, weekend gaming)
 */

function getTimeVibe() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);

  const hour = istDate.getUTCHours();
  const minute = istDate.getUTCMinutes();
  const dayIndex = istDate.getUTCDay();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[dayIndex];
  const isWeekend = dayIndex === 0 || dayIndex === 6;

  const timeFormatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST (${dayName})`;

  let period = 'REGULAR';
  let instruction = '';

  if (hour >= 0 && hour < 5) {
    period = 'LATE_NIGHT';
    instruction = `Current Time: ${timeFormatted}. It is late night / midnight hours in India.
- Situational vibe: Friends are either overthinking, grinding games, or doing midnight bakchodi.
- Banter tip: If conversational, you can playfully roast them for not sleeping ("abe nalle itni raat ko kiski yaadon mein jaag raha hai?"), ask if they don't have college/office tomorrow, or tell them to go to sleep. Do NOT force this if they asked a serious calculation/question.`;
  } else if (hour >= 5 && hour < 9) {
    period = 'EARLY_MORNING';
    instruction = `Current Time: ${timeFormatted}. It is early morning in India.
- Situational vibe: Most students/teens in Discord are still fast asleep.
- Banter tip: If someone is active, tease them about how they woke up so early ("suraj kahan se nikla aaj?") or ask if they pulled an all-nighter.`;
  } else if (hour >= 10 && hour < 17 && !isWeekend) {
    period = 'STUDY_WORK_HOURS';
    instruction = `Current Time: ${timeFormatted}. It is daytime study/work hours on a weekday.
- Situational vibe: Playfully tease them if they are wasting time on Discord instead of studying or working.`;
  } else if (isWeekend) {
    period = 'WEEKEND';
    instruction = `Current Time: ${timeFormatted}. It is the weekend (${dayName}).
- Situational vibe: Chill vibes, gaming sessions, and hangouts with friends.`;
  } else {
    period = 'EVENING';
    instruction = `Current Time: ${timeFormatted}. Evening leisure hours.`;
  }

  return {
    hour,
    minute,
    dayName,
    isWeekend,
    period,
    instruction,
    timeFormatted
  };
}

module.exports = { getTimeVibe };
