/**
 * Date & Time-of-Day Vibe Module (IST / India Standard Time, UTC+5:30)
 * Provides Dogesh with full calendar date, day, year, time, and situational Indian Discord vibe.
 */

function getTimeVibe() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);

  const year = istDate.getUTCFullYear();
  const monthIndex = istDate.getUTCMonth();
  const dayOfMonth = istDate.getUTCDate();
  const dayIndex = istDate.getUTCDay();
  const hour = istDate.getUTCHours();
  const minute = istDate.getUTCMinutes();

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[dayIndex];
  const monthName = months[monthIndex];
  const isWeekend = dayIndex === 0 || dayIndex === 6;

  const hour12 = hour % 12 || 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const minStr = String(minute).padStart(2, '0');
  const hour24Str = String(hour).padStart(2, '0');

  const timeFormatted12 = `${hour12}:${minStr} ${ampm} IST`;
  const timeFormatted24 = `${hour24Str}:${minStr} IST`;
  const timeFormatted = `${timeFormatted12} (${timeFormatted24})`;
  const dateFormatted = `${dayName}, ${dayOfMonth} ${monthName} ${year}`;
  const fullDateTime = `${dateFormatted}, ${timeFormatted12}`;

  let period = 'REGULAR';
  let vibeTip = '';

  if (hour >= 0 && hour < 5) {
    period = 'LATE_NIGHT';
    vibeTip = `It is late night / midnight hours in India.
- Situational vibe: Friends are either overthinking, grinding games, or doing midnight bakchodi.
- Banter tip: If conversational, you can playfully roast them for not sleeping ("abe nalle itni raat ko kiski yaadon mein jaag raha hai?"), ask if they don't have college/office tomorrow, or tell them to go to sleep. Do NOT force this if they asked a serious calculation/question.`;
  } else if (hour >= 5 && hour < 9) {
    period = 'EARLY_MORNING';
    vibeTip = `It is early morning in India.
- Situational vibe: Most students/teens in Discord are still fast asleep.
- Banter tip: If someone is active, tease them about how they woke up so early ("suraj kahan se nikla aaj?") or ask if they pulled an all-nighter.`;
  } else if (hour >= 10 && hour < 17 && !isWeekend) {
    period = 'STUDY_WORK_HOURS';
    vibeTip = `It is daytime study/work hours on a weekday.
- Situational vibe: Playfully tease them if they are wasting time on Discord instead of studying or working.`;
  } else if (isWeekend) {
    period = 'WEEKEND';
    vibeTip = `It is the weekend (${dayName}).
- Situational vibe: Chill vibes, gaming sessions, and hangouts with friends.`;
  } else {
    period = 'EVENING';
    vibeTip = `Evening leisure hours in India.`;
  }

  const instruction = `Current Calendar Date: ${dateFormatted}
Current Time: ${timeFormatted}
Year: ${year} | Month: ${monthName} (${monthIndex + 1}) | Day: ${dayOfMonth} (${dayName})
${vibeTip}
- Critical Date/Time Awareness: You always know the exact current date, day, month, year, and time in India. If anyone asks about the date or time (e.g. "aaj date kya hai", "aaj konsi taareekh hai", "time kya hua", "konsa saal chal raha hai", "aaj kya din hai"), answer accurately, directly, and naturally in your signature casual Hinglish tone!`;

  return {
    year,
    month: monthIndex + 1,
    monthName,
    dayOfMonth,
    hour,
    minute,
    dayName,
    isWeekend,
    period,
    instruction,
    timeFormatted,
    timeFormatted12,
    timeFormatted24,
    dateFormatted,
    fullDateTime
  };
}

module.exports = { getTimeVibe };
