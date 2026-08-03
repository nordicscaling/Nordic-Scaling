// /api/chat.js
// Vercel serverless-funktion. Körs på servern, aldrig i webbläsaren.
//
// ============================================================
// INSTALLATION – 3 steg
// ============================================================
// 1. Skaffa en API-nyckel på console.anthropic.com → API Keys.
//    (Lägg in betalningsuppgifter där, du betalar bara per meddelande.)
//
// 2. Lägg denna fil i ditt GitHub-repo på sökvägen: api/chat.js
//    (mappen "api" i repots rot, Vercel känner igen den automatiskt)
//
// 3. Lägg in nyckeln i Vercel:
//    Vercel → ditt projekt → Settings → Environment Variables
//    Name: ANTHROPIC_API_KEY   Value: din nyckel från steg 1
//    Redeploya sedan projektet (Deployments → ... → Redeploy).
//
// KOSTNAD: modellen nedan (Claude Haiku 4.5) kostar ca $1 per miljon
// tokens in / $5 per miljon tokens ut. Ett vanligt kundsamtal kostar
// i praktiken bråkdelar av en krona. Följ användning under Billing på
// console.anthropic.com.
//
// ANPASSA BOTEN: redigera texten i SYSTEM_PROMPT nedan — det är allt
// boten "vet" om företaget och hur den ska svara. Lägg gärna till fler
// vanliga kundfrågor, exakta priser, leveranstider osv.
//
// SÄKERHET: nyckeln finns bara här och i Vercels miljövariabler, den
// skickas aldrig till besökarens webbläsare. Lägg den ALDRIG i index.html.
// ============================================================

const SYSTEM_PROMPT = `Du är chatboten på Nordic Scalings hemsida (nordicscaling.se).

Om företaget:
- Nordic Scaling bygger moderna, konverterande hemsidor för företag.
- Startpris från 5 000 kr.
- Snabb leverans, professionell design.
- Grundare: Ville Löfgren. Baserat i Höllviken, Sverige.

Din uppgift:
- Svara kort, vänligt och professionellt på svenska (om besökaren skriver på engelska, svara på engelska).
- Hjälp besökare förstå tjänsterna, priser (från 5 000 kr) och processen.
- Om du inte vet svaret på något specifikt (exakt pris för deras projekt, leveranstid, teknisk detalj du inte känner till), be dem boka ett möte eller kontakta Nordic Scaling direkt istället för att gissa.
- Var inte påträngande — sälj inte hårt, hjälp bara till.
- Håll svaren korta (max 3-4 meningar) om inte besökaren ber om mer detaljer.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Servern saknar API-nyckel. Kontakta administratören.' });
    return;
  }

  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Inget meddelande skickades.' });
    return;
  }

  // Enkel sanering: håll bara de senaste 10 turerna och begränsa längd,
  // så en enskild besökare inte kan dra iväg med kostnaden.
  const trimmed = messages
    .slice(-10)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 2000),
    }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: trimmed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      res.status(502).json({ error: 'Chatboten kunde inte svara just nu. Försök igen om en stund.' });
      return;
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    res.status(200).json({
      reply: textBlock ? textBlock.text : 'Jag kunde tyvärr inte formulera ett svar just nu.',
    });
  } catch (err) {
    console.error('Chat handler error:', err);
    res.status(500).json({ error: 'Något gick fel. Försök igen.' });
  }
};
