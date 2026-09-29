import { getSetting } from "./db.js";
import { T } from "./codec.js";
import type { Inbound, UserWithInbounds } from "./types.js";

interface LinkContext {
  host: string;
  address: string;
  user: UserWithInbounds;
  inbound: Inbound;
}

function label(inbound: Inbound): string {
  return inbound.tag;
}

function commonQuery(ctx: LinkContext): Record<string, string> {
  const { inbound, user, host } = ctx;
  const q: Record<string, string> = {
    security: "tls",
    sni: host,
    host,
    fp: user.fingerprint || "chrome",
  };
  q.type = inbound.transport === T.tB ? T.tB : inbound.transport;
  q.path = inbound.path;
  if (inbound.transport === T.tA || inbound.transport === T.tC) {
    q.alpn = "http/1.1";
    q.headerType = "none";
  } else {
    q.alpn = user.alpn || "h2,http/1.1";
  }
  return q;
}

function qs(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

function linkA(ctx: LinkContext): string {
  const { user, address } = ctx;
  const query = qs({ ...commonQuery(ctx), encryption: "none" });
  return `${T.schemeA}${user.uuid}@${address}:443?${query}#${encodeURIComponent(label(ctx.inbound))}`;
}

function linkC(ctx: LinkContext): string {
  const { user, address } = ctx;
  const query = qs(commonQuery(ctx));
  return `${T.schemeC}${encodeURIComponent(user.password)}@${address}:443?${query}#${encodeURIComponent(
    label(ctx.inbound),
  )}`;
}

function linkB(ctx: LinkContext): string {
  const { user, inbound, host, address } = ctx;
  const isXhttp = inbound.transport === T.tB;
  const obj = {
    v: "2",
    ps: label(inbound),
    add: address,
    port: "443",
    id: user.uuid,
    aid: "0",
    scy: "auto",
    net: isXhttp ? T.tB : inbound.transport,
    type: "none",
    host,
    path: inbound.path,
    tls: "tls",
    sni: host,
    alpn: isXhttp ? "h2,http/1.1" : "http/1.1",
    fp: user.fingerprint || "chrome",
  };
  return T.schemeB + Buffer.from(JSON.stringify(obj)).toString("base64");
}

export function buildLink(ctx: LinkContext): string {
  switch (ctx.inbound.protocol) {
    case T.pC:
      return linkC(ctx);
    case T.pB:
      return linkB(ctx);
    default:
      return linkA(ctx);
  }
}

function resolveAddress(host: string): string {
  const clean = (getSetting("clean_address") || "").trim();
  return clean || host;
}

export function buildUserLinks(
  host: string,
  user: UserWithInbounds,
  inbounds: Inbound[],
): { tag: string; protocol: string; transport: string; link: string }[] {
  const address = resolveAddress(host);
  return inbounds
    .filter((ib) => ib.enabled && user.inbound_ids.includes(ib.id))
    .map((inbound) => ({
      tag: inbound.tag,
      protocol: inbound.protocol,
      transport: inbound.transport,
      link: buildLink({ host, address, user, inbound }),
    }));
}
