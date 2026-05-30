// Copy for the nags. Playful pool = sassy guilt-trips; plain pool = straight reminders.
const PLAYFUL = [
  'Still scrolling? 👀 “{task}” isn’t going to do itself.',
  'Psst… “{task}” is waiting. The feed will survive without you.',
  'Breaking news: you have a life. Go finish “{task}”. 📰',
  'Your future self called. They want “{task}” done. ⏰',
  'This scroll is sponsored by procrastination. Try “{task}” instead.',
  '“{task}” misses you. 🥲',
  'Plot twist: closing this tab and doing “{task}” feels amazing.',
  'Achievement locked 🔒 — unlock it by finishing “{task}”.',
  'The algorithm wins again… unless you go do “{task}”.',
  'Quick math: 1 fewer reel = “{task}” done. 🧮',
  'Imagine how smug you’d feel after “{task}”. Go get it. 😎',
  'Hey. Yeah, you. “{task}”. Now. 🫵',
];

const PLAIN = [
  'Reminder: {task}',
  'Don’t forget: {task}',
  'Time to work on: {task}',
  'On your list: {task}',
];

export function nagMessage(taskTitle: string, playful: boolean, rand: () => number = Math.random): string {
  const pool = playful ? PLAYFUL : PLAIN;
  const template = pool[Math.floor(rand() * pool.length)] ?? pool[0];
  return template.replace('{task}', taskTitle);
}

/** A short, escalating header shown above the message. */
export function nagTitle(level: 1 | 2 | 3, playful: boolean): string {
  if (!playful) return 'Task reminder';
  return level >= 3 ? 'OK, we need to talk. 😤' : level === 2 ? 'Seriously though… 🙃' : 'Quick nudge 👇';
}
