/**
 * Vercel — Sueta Base64 Subscription (для Karing / iOS)
 * Отдаёт классическую base64-подписку → Karing видит все сервера
 */

const SUKI_URL = "https://raw.githubusercontent.com/gh8y4gwmsq-web/sUukaaa/refs/heads/main/suki.txt";

export default {
  async fetch(request) {
    try {
      const res = await fetch(SUKI_URL, {
        headers: { "User-Agent": "Vercel-Sueta-Karing/1.0" },
      });

      if (!res.ok) {
        return new Response("GitHub error: " + res.status, { status: 502 });
      }

      const text = await res.text();

      // Берём только рабочие ссылки
      const links = text
        .split("\n")
        .map(l => l.trim())
        .filter(l => 
          l && 
          !l.startsWith("#") && 
          (l.startsWith("vless://") || 
           l.startsWith("trojan://") || 
           l.startsWith("hy2://") || 
           l.startsWith("hysteria2://") || 
           l.startsWith("vmess://"))
        );

      if (links.length === 0) {
        return new Response("No servers found", { status: 404 });
      }

      // Классическая base64-подписка
      const subscription = btoa(links.join("\n"));

      return new Response(subscription, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "profile-title": "Sueta",
          "profile-update-interval": "4",
          "subscription-userinfo": `upload=0; download=0; total=0; expire=0`,
          "support-url": "https://t.me/SuetaVpna",
          "profile-web-page-url": "https://t.me/SuetaVpna",
        },
      });
    } catch (err) {
      return new Response("Ошибка: " + err.message, { status: 502 });
    }
  },
};
