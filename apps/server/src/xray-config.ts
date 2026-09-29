import { config } from "./config.js";
import { listEnabledInbounds } from "./inbounds.js";
import { listUsers, isUserActive } from "./users.js";
import { listRoutingRules } from "./routing.js";
import { T } from "./codec.js";
import type { Inbound, UserWithInbounds } from "./types.js";

function streamSettings(inbound: Inbound) {
  const base: Record<string, unknown> = { network: inbound.transport };
  if (inbound.transport === T.tA) {
    base[T.sA] = { path: inbound.path, host: inbound.host || undefined };
  } else if (inbound.transport === T.tC) {
    base[T.sB] = { path: inbound.path, host: inbound.host || undefined };
  } else if (inbound.transport === T.tB) {
    base[T.sC] = { path: inbound.path, host: inbound.host || undefined, mode: "auto" };
  }
  return base;
}

function inboundClients(inbound: Inbound, users: UserWithInbounds[]) {
  return users.filter((u) => isUserActive(u) && u.inbound_ids.includes(inbound.id));
}

function protocolSettings(inbound: Inbound, users: UserWithInbounds[]) {
  const clients = inboundClients(inbound, users);
  if (inbound.protocol === T.pA) {
    return {
      clients: clients.map((c) => ({ id: c.uuid, email: c.email, flow: "" })),
      decryption: "none",
    };
  }
  if (inbound.protocol === T.pB) {
    return {
      clients: clients.map((c) => ({ id: c.uuid, email: c.email })),
    };
  }
  return {
    clients: clients.map((c) => ({ password: c.password, email: c.email })),
  };
}

function buildRoutingRules(inbounds: Inbound[]) {
  const rules: Record<string, unknown>[] = [
    { type: "field", inboundTag: ["api"], outboundTag: "api" },
  ];
  const tagById = new Map(inbounds.map((i) => [i.id, i.tag]));
  const routingRules = listRoutingRules();

  for (const rule of routingRules) {
    const values = rule.domain
      .split(/[\s,]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    const targetTags =
      rule.inbound_ids.length === 0
        ? inbounds.map((i) => i.tag)
        : rule.inbound_ids.map((id) => tagById.get(id)).filter((t): t is string => !!t);
    if (targetTags.length === 0) continue;
    const base: Record<string, unknown> = {
      type: "field",
      inboundTag: targetTags,
      outboundTag: "blocked",
    };
    if (rule.kind === "ip") base.ip = values;
    else base.domain = values;
    rules.push(base);
  }
  return rules;
}

export function buildXrayConfig() {
  const inbounds = listEnabledInbounds();
  const users = listUsers();

  const inboundConfigs = inbounds.map((ib) => ({
    tag: ib.tag,
    listen: "127.0.0.1",
    port: ib.port,
    protocol: ib.protocol,
    settings: protocolSettings(ib, users),
    streamSettings: streamSettings(ib),
    sniffing: { enabled: false, destOverride: [] },
  }));

  return {
    log: { loglevel: "warning", access: config.xrayAccessLog },
    api: {
      tag: "api",
      services: ["HandlerService", "StatsService", "LoggerService"],
    },
    stats: {},
    policy: {
      levels: { "0": { statsUserUplink: true, statsUserDownlink: true } },
      system: {
        statsInboundUplink: true,
        statsInboundDownlink: true,
      },
    },
    inbounds: [
      {
        tag: "api",
        listen: "127.0.0.1",
        port: config.xrayApiPort,
        protocol: T.oDoor,
        settings: { address: "127.0.0.1" },
      },
      ...inboundConfigs,
    ],
    outbounds: [
      { tag: "direct", protocol: T.oFree, settings: {} },
      { tag: "blocked", protocol: T.oBlock, settings: {} },
    ],
    routing: {
      domainStrategy: "AsIs",
      rules: buildRoutingRules(inbounds),
    },
  };
}
