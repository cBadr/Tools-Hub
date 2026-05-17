export type ProxyType = "http" | "https" | "socks4" | "socks5";

export interface ProxySource {
  key: string;
  label: string;
  url: string;
  type: ProxyType;
  format: "ip_port_lines" | "csv_table";
}

export const PROXY_SOURCES: ProxySource[] = [
  // ProxyScrape API
  { key: "proxyscrape-http",   label: "ProxyScrape · HTTP",   type: "http",   format: "ip_port_lines", url: "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all" },
  { key: "proxyscrape-socks4", label: "ProxyScrape · SOCKS4", type: "socks4", format: "ip_port_lines", url: "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000" },
  { key: "proxyscrape-socks5", label: "ProxyScrape · SOCKS5", type: "socks5", format: "ip_port_lines", url: "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000" },
  // TheSpeedX lists
  { key: "speedx-http",   label: "TheSpeedX · HTTP",   type: "http",   format: "ip_port_lines", url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt" },
  { key: "speedx-socks4", label: "TheSpeedX · SOCKS4", type: "socks4", format: "ip_port_lines", url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt" },
  { key: "speedx-socks5", label: "TheSpeedX · SOCKS5", type: "socks5", format: "ip_port_lines", url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt" },
  // Monosans lists
  { key: "monosans-http",   label: "Monosans · HTTP",   type: "http",   format: "ip_port_lines", url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt" },
  { key: "monosans-socks4", label: "Monosans · SOCKS4", type: "socks4", format: "ip_port_lines", url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt" },
  { key: "monosans-socks5", label: "Monosans · SOCKS5", type: "socks5", format: "ip_port_lines", url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt" },
  // Clarketm
  { key: "clarketm-http", label: "Clarketm · HTTP",   type: "http",   format: "ip_port_lines", url: "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt" },
  // HideMyName / custom
  { key: "hookzof-socks5", label: "Hookzof · SOCKS5", type: "socks5", format: "ip_port_lines", url: "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt" },
];

export function getSourceByKey(key: string): ProxySource | undefined {
  return PROXY_SOURCES.find((s) => s.key === key);
}

export interface ParsedProxy {
  type: ProxyType;
  host: string;
  port: number;
}

export function parseProxyText(text: string, defaultType: ProxyType = "http"): ParsedProxy[] {
  const results: ParsedProxy[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // Detect prefix like "socks5://1.2.3.4:1080" or "http://..."
    let type: ProxyType = defaultType;
    let addr = line;

    const prefixMatch = line.match(/^(https?|socks[45]):\/\//i);
    if (prefixMatch) {
      const proto = prefixMatch[1].toLowerCase();
      type = proto === "https" ? "https" : proto === "socks4" ? "socks4" : proto === "socks5" ? "socks5" : "http";
      addr = line.replace(/^[^/]+:\/\//, "");
    }

    // Strip trailing path/params
    addr = addr.split("/")[0].split("?")[0].trim();

    // IPv4:port  or  [ipv6]:port  or  host:port
    const portMatch = addr.match(/^(.+):(\d+)$/);
    if (!portMatch) continue;

    const host = portMatch[1].replace(/^\[|\]$/g, "").trim();
    const port = parseInt(portMatch[2], 10);

    if (!host || isNaN(port) || port < 1 || port > 65535) continue;

    const key = `${type}:${host}:${port}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ type, host, port });
  }

  return results;
}
