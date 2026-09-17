/**
 * Vercel Edge Function — Sueta → sing-box Auto JSON
 * Только Auto (urltest), без отдельных профилей
 * Поддержка: VLESS (Reality/TLS + tcp/ws/grpc), Trojan, Hysteria2, VMess
 * XHTTP пропускается (официальный sing-box его не поддерживает)
 */

const SUKI_URL = "https://raw.githubusercontent.com/gh8y4gwmsq-web/sUukaaa/refs/heads/main/suki.txt";

export default {
  async fetch(request) {
    try {
      const res = await fetch(SUKI_URL, {
        headers: { "User-Agent": "Vercel-Sueta-singbox/1.0" },
      });

      if (!res.ok) {
        return new Response("GitHub error: " + res.status, { status: 502 });
      }

      const text = await res.text();
      const config = buildSingboxConfig(text);

      return new Response(JSON.stringify(config, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "profile-title": "Sueta-sing-box",
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

function buildSingboxConfig(sukiText) {
  const lines = sukiText.split("\n").map(l => l.trim()).filter(Boolean);
  const links = lines.filter(l => !l.startsWith("#"));

  const proxies = [];
  const tags = [];

  links.forEach((link, i) => {
    try {
      const outbound = parseToSingbox(link, i);
      if (outbound) {
        proxies.push(outbound);
        tags.push(outbound.tag);
      }
    } catch (e) {
      // skip
    }
  });

  // urltest (Auto)
  const urltest = {
    type: "urltest",
    tag: "auto",
    outbounds: tags,
    url: "https://www.gstatic.com/generate_204",
    interval: "3m",
    tolerance: 50,
    idle_timeout: "30m",
  };

  const directDomains = [
    "vk.com", "vk.ru", "userapi.com", "vk-cdn.net",
    "ok.ru", "okcdn.ru",
    "max.ru", "web.max.ru",
    "dzen.ru",
    "yandex.ru", "yandex.com", "yandex.net", "ya.ru", "yastatic.net",
    "kinopoisk.ru",
    "mail.ru",
    "rutube.ru",
    "okko.tv", "premier.one", "ivi.ru", "wink.ru", "more.tv",
    "wildberries.ru", "wb.ru",
    "ozon.ru",
    "avito.ru",
    "lamoda.ru",
    "dns-shop.ru", "mvideo.ru", "eldorado.ru", "citilink.ru",
    "5ka.ru", "pyaterochka.ru", "perekrestok.ru",
    "2gis.ru", "cian.ru", "youla.ru", "drom.ru", "auto.ru",
    "sberbank.ru", "sber.ru", "tinkoff.ru", "tbank.ru",
    "alfabank.ru", "vtb.ru", "gazprombank.ru",
    "gosuslugi.ru", "mos.ru", "nalog.ru", "cbr.ru",
    "hh.ru",
    "rbc.ru", "rambler.ru", "tutu.ru",
  ];

  return {
    log: {
      level: "warn",
      timestamp: true,
    },
    dns: {
      servers: [
        {
          tag: "dns-remote",
          address: "https://1.1.1.1/dns-query",
          detour: "auto",
        },
        {
          tag: "dns-local",
          address: "local",
          detour: "direct",
        },
      ],
      rules: [
        {
          domain_suffix: directDomains,
          server: "dns-local",
        },
      ],
      final: "dns-remote",
      strategy: "prefer_ipv4",
    },
    inbounds: [
      {
        type: "mixed",
        tag: "mixed-in",
        listen: "127.0.0.1",
        listen_port: 10808,
        sniff: true,
        sniff_override_destination: true,
      },
    ],
    outbounds: [
      urltest,
      ...proxies,
      { type: "direct", tag: "direct" },
      { type: "block", tag: "block" },
    ],
    route: {
      rules: [
        {
          protocol: "dns",
          outbound: "dns-out", // fallback, но у нас dns отдельно
        },
        {
          domain_suffix: directDomains,
          outbound: "direct",
        },
        {
          domain_keyword: ["ads", "ad.", "advert", "doubleclick", "googlesyndication"],
          outbound: "block",
        },
        {
          ip_is_private: true,
          outbound: "direct",
        },
      ],
      final: "auto",
      auto_detect_interface: true,
    },
    experimental: {
      cache_file: {
        enabled: true,
        path: "cache.db",
      },
    },
  };
}

function parseToSingbox(link, index) {
  let name = `proxy-${String(index + 1).padStart(2, "0")}`;
  if (link.includes("#")) {
    name = decodeURIComponent(link.split("#").pop() || name);
  }

  // ===== Hysteria2 =====
  if (link.startsWith("hy2://") || link.startsWith("hysteria2://")) {
    const raw = link.replace(/^hy2:\/\//, "").replace(/^hysteria2:\/\//, "");
    const [mainPart] = raw.split("#");
    const [authHost, queryPart] = mainPart.split("?");
    const [auth, hostPort] = authHost.includes("@") ? authHost.split("@") : ["", authHost];
    const [host, portStr] = hostPort.includes(":") ? hostPort.split(":") : [hostPort, "443"];
    const port = parseInt(portStr) || 443;

    const params = {};
    if (queryPart) {
      queryPart.split("&").forEach(p => {
        const [k, v] = p.split("=");
        params[k] = decodeURIComponent(v || "");
      });
    }

    return {
      type: "hysteria2",
      tag: name,
      server: host,
      server_port: port,
      password: auth,
      tls: {
        enabled: true,
        server_name: params.sni || host,
        alpn: (params.alpn || "h3").split(","),
        insecure: false,
      },
    };
  }

  // ===== VMess =====
  if (link.startsWith("vmess://")) {
    const b64 = link.slice(8).split("#")[0];
    const json = JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    const host = json.add || json.host;
    const port = parseInt(json.port) || 443;
    const network = (json.net || "tcp").toLowerCase();

    const outbound = {
      type: "vmess",
      tag: json.ps || name,
      server: host,
      server_port: port,
      uuid: json.id,
      security: json.scy || "auto",
      alter_id: parseInt(json.aid) || 0,
    };

    if (json.tls === "tls" || json.tls === "reality") {
      outbound.tls = {
        enabled: true,
        server_name: json.sni || host,
        utls: {
          enabled: true,
          fingerprint: json.fp || "chrome",
        },
      };
      if (json.tls === "reality") {
        outbound.tls.reality = {
          enabled: true,
          public_key: json.pbk,
          short_id: json.sid || "",
        };
      }
    }

    if (network === "ws") {
      outbound.transport = {
        type: "ws",
        path: json.path || "/",
        headers: json.host ? { Host: json.host } : {},
      };
    } else if (network === "grpc") {
      outbound.transport = {
        type: "grpc",
        service_name: json.path || json.serviceName || "",
      };
    }

    return outbound;
  }

  // ===== VLESS / Trojan =====
  const url = new URL(link);
  const protocol = url.protocol.replace(":", "");
  const uuidOrPass = decodeURIComponent(url.username);
  const host = url.hostname;
  const port = parseInt(url.port) || 443;
  const params = Object.fromEntries(url.searchParams.entries());
  const network = (params.type || "tcp").toLowerCase();

  // XHTTP не поддерживается официальным sing-box → пропускаем
  if (network === "xhttp" || network === "splithttp") {
    return null;
  }

  if (protocol === "vless") {
    const outbound = {
      type: "vless",
      tag: name,
      server: host,
      server_port: port,
      uuid: uuidOrPass,
      packet_encoding: "xudp",
    };

    if (params.flow && params.flow !== "") {
      outbound.flow = params.flow;
    }

    // TLS / Reality
    if (params.security === "reality" || params.security === "tls") {
      outbound.tls = {
        enabled: true,
        server_name: params.sni || host,
        utls: {
          enabled: true,
          fingerprint: params.fp || "chrome",
        },
      };

      if (params.security === "reality") {
        outbound.tls.reality = {
          enabled: true,
          public_key: params.pbk,
          short_id: params.sid || "",
        };
      }

      if (params.alpn) {
        outbound.tls.alpn = params.alpn.split(",");
      }
    }

    // Transport
    if (network === "ws") {
      outbound.transport = {
        type: "ws",
        path: params.path || "/",
        headers: params.host ? { Host: params.host } : {},
      };
    } else if (network === "grpc") {
      outbound.transport = {
        type: "grpc",
        service_name: params.serviceName || params.path || "",
      };
    } else if (network === "httpupgrade") {
      outbound.transport = {
        type: "httpupgrade",
        path: params.path || "/",
        host: params.host || host,
      };
    }
    // tcp — ничего не добавляем

    return outbound;
  }

  if (protocol === "trojan") {
    const outbound = {
      type: "trojan",
      tag: name,
      server: host,
      server_port: port,
      password: uuidOrPass,
    };

    if (params.security === "tls" || !params.security) {
      outbound.tls = {
        enabled: true,
        server_name: params.sni || host,
        utls: {
          enabled: true,
          fingerprint: params.fp || "chrome",
        },
      };
      if (params.alpn) {
        outbound.tls.alpn = params.alpn.split(",");
      }
    }

    if (network === "ws") {
      outbound.transport = {
        type: "ws",
        path: params.path || "/",
        headers: params.host ? { Host: params.host } : {},
      };
    }

    return outbound;
  }

  return null;
}
