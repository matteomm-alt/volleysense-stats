import { supabase } from "@/integrations/supabase/client";

// Parse "YYYY-MM-DD" as a local date (no timezone shift).
function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export type CurrentWeekInfo = {
  periodo_id: string;
  periodo_name: string;
  settimana_id: string;
  week_number: number;
};

/**
 * Ritorna la settimana corrente (non-template) attiva per il team, oppure null
 * se nessuna settimana copre la data odierna.
 */
export async function findCurrentWeeksForTeam(
  teamId: string,
): Promise<CurrentWeekInfo[]> {
  const today = todayLocal();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data: periodi } = await supabase
    .from("periodi")
    .select("id, name, start_date")
    .eq("team_id", teamId)
    .lte("start_date", todayStr)
    .gte("end_date", todayStr);

  if (!periodi?.length) return [];

  const results: CurrentWeekInfo[] = [];
  for (const p of periodi) {
    if (!p.start_date) continue;
    const { data: sett } = await supabase
      .from("settimane")
      .select("id, week_number")
      .eq("periodo_id", p.id)
      .eq("is_template", false);
    if (!sett?.length) continue;

    const periodoStart = parseYMD(p.start_date as string);
    for (const s of sett) {
      const wn = s.week_number ?? 0;
      if (wn < 1) continue;
      const wStart = addDays(periodoStart, (wn - 1) * 7);
      const wEnd = addDays(wStart, 6);
      if (today >= wStart && today <= wEnd) {
        results.push({
          periodo_id: p.id,
          periodo_name: (p as { name: string }).name,
          settimana_id: s.id,
          week_number: wn,
        });
        break;
      }
    }
  }
  return results;
}