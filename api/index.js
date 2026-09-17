/**
 * Vercel — Sueta Clash Meta (для Karing iOS)
 * Читаемый YAML, максимальная совместимость
 */

const SUKI_URL = "https://raw.githubusercontent.com/gh8y4gwmsq-web/sUukaaa/refs/heads/main/suki.txt";

export default {
  async fetch(request) {
    try {
      const res = await fetch(SUKI_URL, {
        headers: { "User-Agent": "Vercel-Sueta-Clash/1.0" },
      });

      if (!res.ok) {
        return new Response("GitHub error: " + res.status, { status: 502 });
      }

      const text = await res.text();
      const yaml = buildClash(text);

      return new Response(yaml, {
        status: 200,
        headers: {
          "Content-Type": "text/yaml; charset=utf-8",
          "profile-title": "Sueta",
          "profile-update-interval": "4",
          "support-url": "https://t.me/SuetaVpna",
          "profile-web-page-url": "https://t.me/SuetaVpna",
        },
      });
    } catch (err) {
      return new Response("Ошибка: " + err.message, { status: 502 });
    }
  },
};

function buildClash(sukiText) {
  const lines = sukiText.split("\n").map(l => l.trim()).filter(Boolean);
  const links = lines.filter(l => !l.startsWith("#"));

  const proxies = [];
  const proxyNames = [];

  links.forEach((link, i) => {
    try {
      const proxy = parseLinkToClash(link, i);
      if (proxy) {
        proxies.push(proxy);
        proxyNames.push(proxy.name);
      }
    } catch (e) {}
  });

  // YAML вручную (без внешних библиотек)
  let yaml = `mixed-port: 7890
allow-lan: true
mode: rule
log-level: info
external-controller: 127.0.0.1:9090

dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: fake-ip
  nameserver:
    - 1.1.1.1
    - 8.8.8.8
  fallback:
    - https://dns.adguard.com/dns-query

proxies:
`;

  // Добавляем прокси
  for (const p of proxies) {
    yaml += `  - name: "${p.name}"\n`;
    yaml += `    type: ${p.type}\n`;
    yaml += `    server: ${p.server}\n`;
    yaml += `    port: ${p.port}\n`;

    if (p.type === "vless") {
      yaml += `    uuid: ${p.uuid}\n`;
      if (p.flow) yaml += `    flow: ${p.flow}\n`;
      yaml += `    tls: true\n`;
      yaml += `    udp: true\n`;
      yaml += `    network: ${p.network || "tcp"}\n`;
      if (p.servername) yaml += `    servername: ${p.servername}\n`;
      if (p.clientFingerprint) yaml += `    client-fingerprint: ${p.clientFingerprint}\n`;
      if (p.reality) {
        yaml += `    reality-opts:\n`;
        yaml += `      public-key: ${p.reality.publicKey}\n`;
        if (p.reality.shortId) yaml += `      short-id: ${p.reality.shortId}\n`;
      }
      if (p.network === "ws") {
        yaml += `    ws-opts:\n`;
        yaml += `      path: ${p.path || "/"}\n`;
        if (p.host) yaml += `      headers:\n        Host: ${p.host}\n`;
      }
      if (p.network === "grpc") {
        yaml += `    grpc-opts:\n`;
        yaml += `      grpc-service-name: ${p.serviceName || ""}\n`;
      }
    }

    if (p.type === "trojan") {
      yaml += `    password: ${p.password}\n`;
      yaml += `    udp: true\n`;
      yaml += `    sni: ${p.sni || p.server}\n`;
      if (p.clientFingerprint) yaml += `    client-fingerprint: ${p.clientFingerprint}\n`;
    }

    if (p.type === "hysteria2") {
      yaml += `    password: ${p.password}\n`;
      yaml += `    sni: ${p.sni || p.server}\n`;
      yaml += `    skip-cert-verify: false\n`;
    }

    yaml += `\n`;
  }

  // Группы
  yaml += `proxy-groups:
  - name: "🚀 Auto"
    type: url-test
    proxies:
${proxyNames.map(n => `      - "${n}"`).join("\n")}
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

  - name: "🎯 Select"
    type: select
    proxies:
      - "🚀 Auto"
${proxyNames.map(n => `      - "${n}"`).join("\n")}
      - DIRECT

rules:
  - DOMAIN-SUFFIX,vk.com,DIRECT
  - DOMAIN-SUFFIX,vk.ru,DIRECT
  - DOMAIN-SUFFIX,max.ru,DIRECT
  - DOMAIN-SUFFIX,yandex.ru,DIRECT
  - DOMAIN-SUFFIX,yandex.com,DIRECT
  - DOMAIN-SUFFIX,mail.ru,DIRECT
  - DOMAIN-SUFFIX,ok.ru,DIRECT
  - DOMAIN-SUFFIX,wildberries.ru,DIRECT
  - DOMAIN-SUFFIX,ozon.ru,DIRECT
  - DOMAIN-SUFFIX,avito.ru,DIRECT
  - DOMAIN-SUFFIX,gosuslugi.ru,DIRECT
  - DOMAIN-SUFFIX,sberbank.ru,DIRECT
  - DOMAIN-SUFFIX,tinkoff.ru,DIRECT
  - DOMAIN-SUFFIX,tbank.ru,DIRECT
  - GEOIP,RU,DIRECT
  - MATCH,🚀 Auto
`;

  return yaml;
}

function parseLinkToClash(link, index) {
  let name = `Server-${String(index + 1).padStart(2, "0")}`;
  if (link.includes("#")) {
    name = decodeURIComponent(link.split("#").pop() || name).replace(/"/g, "'");
  }

  // Hysteria2
  if (link.startsWith("hy2://") || link.startsWith("hysteria2://")) {
    const raw = link.replace(/^hy2:\/\//, "").replace(/^hysteria2:\/\//, "");
    const [main] = raw.split("#");
    const [authHost, query] = main.split("?");
    const [auth, hostPort] = authHost.includes("@") ? authHost.split("@") : ["", authHost];
    const [host, portStr] = hostPort.split(":");
    const port = parseInt(portStr) || 443;

    const params = {};
    if (query) {
      query.split("&").forEach(p => {
        const [k, v] = p.split("=");
        params[k] = decodeURIComponent(v || "");
      });
    }

    return {
      name,
      type: "hysteria2",
      server: host,
      port,
      password: auth,
      sni: params.sni || host,
    };
  }

  // VLESS / Trojan
  try {
    const url = new URL(link);
    const protocol = url.protocol.replace(":", "");
    const uuidOrPass = decodeURIComponent(url.username);
    const host = url.hostname;
    const port = parseInt(url.port) || 443;
    const params = Object.fromEntries(url.searchParams.entries());
    const network = (params.type || "tcp").toLowerCase();

    // XHTTP пропускаем
    if (network === "xhttp" || network === "splithttp") return null;

    if (protocol === "vless") {
      const proxy = {
        name,
        type: "vless",
        server: host,
        port,
        uuid: uuidOrPass,
        network: network === "tcp" ? "tcp" : network,
        servername: params.sni || host,
        clientFingerprint: params.fp || "chrome",
      };

      if (params.flow) proxy.flow = params.flow;

      if (params.security === "reality") {
        proxy.reality = {
          publicKey: params.pbk,
          shortId: params.sid || "",
        };
      }

      if (network === "ws") {
        proxy.path = params.path || "/";
        proxy.host = params.host;
      }
      if (network === "grpc") {
        proxy.serviceName = params.serviceName || params.path || "";
      }

      return proxy;
    }

    if (protocol === "trojan") {
      return {
        name,
        type: "trojan",
        server: host,
        port,
        password: uuidOrPass,
        sni: params.sni || host,
        clientFingerprint: params.fp || "chrome",
      };
    }
  } catch (e) {}

  return null;
}
