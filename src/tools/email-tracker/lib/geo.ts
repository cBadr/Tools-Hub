import type { GeoData } from "@/types/email-tracker";

export async function getGeoData(ip: string): Promise<GeoData | null> {
  if (!ip || ip === "unknown") return null;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,query`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) return null;

    const data: GeoData = await res.json();
    if (data.status !== "success") return null;

    return data;
  } catch {
    return null;
  }
}
