import type { Inbound, UserWithInbounds } from "./types.js";
import { getSetting } from "./db.js";
import { T } from "./codec.js";

function cleanAddr(host: string): string {
  const clean = (getSetting("clean_address") || "").trim();
  return clean || host;
}

interface Ctx {
  host: string;
  user: UserWithInbounds;
  inbound: Inbound;
}

function net(inbound: Inbound): string {
  return inbound.transport === T.tB ? T.tB : inbound.transport;
}

function outboundA(ctx: Ctx): Record<string, unknown> | null {
  const { user, inbound, host } = ctx;
  const addr = cleanAddr(host);
  const name = `${inbound.tag}`;
  const alpn = user.alpn ? user.alpn.split(",").map((a) => a.trim()) : undefined;
  const wsOpts = {
    path: inbound.path,
    headers: { Host: host },
  };

  if (inbound.protocol === T.pA) {
    if (inbound.transport === T.tB) return null;
    return {
      name,
      type: T.pA,
      server: addr,
      port: 443,
      uuid: user.uuid,
      udp: true,
      tls: true,
      servername: host,
      network: T.tA,
      "client-fingerprint": user.fingerprint || "chrome",
      alpn,
      "ws-opts": wsOpts,
    };
  }
  if (inbound.protocol === T.pB) {
    return {
      name,
      type: T.pB,
      server: addr,
      port: 443,
      uuid: user.uuid,
      alterId: 0,
      cipher: "auto",
      udp: true,
      tls: true,
      servername: host,
      network: T.tA,
      "client-fingerprint": user.fingerprint || "chrome",
      alpn,
      "ws-opts": wsOpts,
    };
  }
  return {
    name,
    type: T.pC,
    server: addr,
    port: 443,
    password: user.password,
    udp: true,
    sni: host,
    network: T.tA,
    "client-fingerprint": user.fingerprint || "chrome",
    alpn,
    "ws-opts": wsOpts,
  };
}

export function buildClashConfig(
  host: string,
  user: UserWithInbounds,
  inbounds: Inbound[],
): string {
  const proxies = inbounds
    .filter((ib) => ib.enabled && user.inbound_ids.includes(ib.id))
    .map((inbound) => outboundA({ host, user, inbound }))
    .filter((p): p is Record<string, unknown> => p !== null);

  const names = proxies.map((p) => p.name as string);
  const yaml: string[] = [];
  yaml.push("proxies:");
  for (const p of proxies) {
    const parts = Object.entries(p)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => {
        if (typeof v === "object") return `${k}: ${JSON.stringify(v)}`;
        if (typeof v === "string") return `${k}: ${JSON.stringify(v)}`;
        return `${k}: ${v}`;
      });
    yaml.push(`  - { ${parts.join(", ")} }`);
  }
  yaml.push("proxy-groups:");
  yaml.push(`  - name: PROXY`);
  yaml.push(`    type: select`);
  yaml.push(`    proxies: [${names.join(", ")}]`);
  yaml.push("rules:");
  yaml.push("  - MATCH,PROXY");
  return yaml.join("\n");
}

function outboundB(ctx: Ctx): Record<string, unknown> | null {
  const { user, inbound, host } = ctx;
  const addr = cleanAddr(host);
  const tag = inbound.tag;
  const tls = {
    enabled: true,
    server_name: host,
    utls: { enabled: true, fingerprint: user.fingerprint || "chrome" },
    alpn: user.alpn ? user.alpn.split(",").map((a) => a.trim()) : undefined,
  };
  const transport =
    inbound.transport === T.tB
      ? { type: T.http, path: inbound.path, host: [host] }
      : { type: T.tA, path: inbound.path, headers: { Host: host } };

  if (inbound.protocol === T.pA) {
    return {
      type: T.pA,
      tag,
      server: addr,
      server_port: 443,
      uuid: user.uuid,
      tls,
      transport,
    };
  }
  if (inbound.protocol === T.pB) {
    return {
      type: T.pB,
      tag,
      server: addr,
      server_port: 443,
      uuid: user.uuid,
      alter_id: 0,
      security: "auto",
      tls,
      transport,
    };
  }
  return {
    type: T.pC,
    tag,
    server: addr,
    server_port: 443,
    password: user.password,
    tls,
    transport,
  };
}

export function buildSingboxConfig(
  host: string,
  user: UserWithInbounds,
  inbounds: Inbound[],
): string {
  const outbounds = inbounds
    .filter((ib) => ib.enabled && user.inbound_ids.includes(ib.id))
    .map((inbound) => outboundB({ host, user, inbound }))
    .filter((o): o is Record<string, unknown> => o !== null);

  const tags = outbounds.map((o) => o.tag as string);

  const config = {
    outbounds: [
      {
        type: "selector",
        tag: "PROXY",
        outbounds: [...tags, "direct"],
        default: tags[0],
      },
      ...outbounds,
      { type: "direct", tag: "direct" },
    ],
  };
  return JSON.stringify(config, null, 2);
}

void net;
