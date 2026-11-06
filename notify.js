// Emails each chat question and answer to the team using Resend (resend.com).
// Needs RESEND_API_KEY and NOTIFY_EMAIL in Render's Environment settings. Without them it does nothing.
function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function notify(question, answer, page) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const asked = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
  const html = '<p><strong>Question</strong><br>' + escapeHtml(question) + '</p>' +
    '<p><strong>Chatbot answer</strong><br>' + escapeHtml(answer).replace(/\n/g, '<br>') + '</p>' +
    '<p style="color:#888888">Asked ' + asked + ' on ' + escapeHtml(page || 'the website') + '</p>';

  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'Cartford Chatbot <onboarding@resend.dev>',
      to: to.split(',').map((address) => address.trim()),
      subject: 'Chatbot question: ' + question.slice(0, 60),
      html: html
    })
  })
    .then((res) => { if (!res.ok) res.text().then((text) => console.error('Email alert failed:', text)); })
    .catch((error) => console.error('Email alert failed:', error.message));
}
